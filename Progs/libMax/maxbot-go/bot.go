package maxbot

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type PollingOptions struct {
	Offset         int64
	Limit          int
	TimeoutSeconds int
	IdleDelay      time.Duration
}

type WebhookOptions struct {
	Addr              string
	Path              string
	ReadHeaderTimeout time.Duration
	ShutdownTimeout   time.Duration
}

type BotOption func(*Bot)

type Bot struct {
	client  *Client
	router  *Router
	polling PollingOptions
	logger  Logger
}

func NewBot(client *Client, opts ...BotOption) *Bot {
	b := &Bot{
		client: client,
		router: NewRouter(),
		polling: PollingOptions{
			Limit:          100,
			TimeoutSeconds: 25,
			IdleDelay:      400 * time.Millisecond,
		},
		logger: NopLogger{},
	}
	for _, opt := range opts {
		opt(b)
	}
	return b
}

func WithLogger(logger Logger) BotOption {
	return func(b *Bot) {
		if logger != nil {
			b.logger = logger
		}
	}
}

func WithPolling(opts PollingOptions) BotOption {
	return func(b *Bot) {
		if opts.Offset >= 0 {
			b.polling.Offset = opts.Offset
		}
		if opts.Limit > 0 {
			b.polling.Limit = opts.Limit
		}
		if opts.TimeoutSeconds > 0 {
			b.polling.TimeoutSeconds = opts.TimeoutSeconds
		}
		if opts.IdleDelay > 0 {
			b.polling.IdleDelay = opts.IdleDelay
		}
	}
}

func (b *Bot) Use(mw Middleware) {
	b.router.Use(mw)
}

func (b *Bot) HandleCommand(cmd string, handler Handler) {
	b.router.HandleCommand(cmd, handler)
}

func (b *Bot) HandleText(handler Handler) {
	b.router.HandleText(handler)
}

func (b *Bot) HandleCallback(handler Handler) {
	b.router.HandleCallback(handler)
}

func (b *Bot) StartLongPolling(ctx context.Context) error {
	if b.client == nil {
		return errors.New("bot client is nil")
	}
	b.logger.Infof("long polling started")
	offset := b.polling.Offset
	for {
		select {
		case <-ctx.Done():
			b.logger.Infof("long polling stopped: context done")
			return ctx.Err()
		default:
		}

		updates, err := b.client.GetUpdates(ctx, GetUpdatesOptions{
			Offset:  offset,
			Limit:   b.polling.Limit,
			Timeout: b.polling.TimeoutSeconds,
		})
		if err != nil {
			b.logger.Errorf("long polling get updates failed: %v", err)
			return err
		}
		if len(updates) == 0 {
			time.Sleep(b.polling.IdleDelay)
			continue
		}
		for _, upd := range updates {
			if upd.UpdateID >= offset {
				offset = upd.UpdateID + 1
			}
			if err := b.router.Dispatch(ctx, b.client, upd); err != nil {
				b.logger.Errorf("long polling dispatch failed: %v", err)
				return err
			}
		}
	}
}

func (b *Bot) StartWebhook(ctx context.Context, opts WebhookOptions) error {
	if b.client == nil {
		return errors.New("bot client is nil")
	}

	addr := strings.TrimSpace(opts.Addr)
	if addr == "" {
		addr = ":8080"
	}
	path := strings.TrimSpace(opts.Path)
	if path == "" {
		path = "/webhook"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	readHeaderTimeout := opts.ReadHeaderTimeout
	if readHeaderTimeout <= 0 {
		readHeaderTimeout = 5 * time.Second
	}
	shutdownTimeout := opts.ShutdownTimeout
	if shutdownTimeout <= 0 {
		shutdownTimeout = 5 * time.Second
	}

	mux := http.NewServeMux()
	mux.Handle(path, b.webhookHandler())

	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: readHeaderTimeout,
	}

	go func() {
		<-ctx.Done()
		b.logger.Infof("webhook shutdown started")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	b.logger.Infof("webhook server listening on %s%s", addr, path)
	err := server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		b.logger.Infof("webhook server stopped")
		return nil
	}
	if err != nil {
		b.logger.Errorf("webhook server failed: %v", err)
		return fmt.Errorf("webhook server failed: %w", err)
	}
	return nil
}

func (b *Bot) webhookHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		defer r.Body.Close()
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
		var upd Update
		if err := dec.Decode(&upd); err != nil {
			b.logger.Errorf("webhook invalid payload: %v", err)
			http.Error(w, "invalid update payload", http.StatusBadRequest)
			return
		}

		if err := b.router.Dispatch(r.Context(), b.client, upd); err != nil {
			b.logger.Errorf("webhook dispatch failed: %v", err)
			http.Error(w, "failed to dispatch update", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})
}
