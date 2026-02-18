package maxbot

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

const defaultTimeout = 30 * time.Second
const defaultRateLimitRPS = 30

type ClientConfig struct {
	Token          string
	BaseURL        string
	HTTPClient     *http.Client
	MaxRetries     int
	InitialBackoff time.Duration
	MaxBackoff     time.Duration
	RateLimitRPS   int
}

type Client struct {
	token          string
	baseURL        string
	httpClient     *http.Client
	maxRetries     int
	initialBackoff time.Duration
	maxBackoff     time.Duration
	limiter        *rateLimiter
}

func NewClient(cfg ClientConfig) (*Client, error) {
	if strings.TrimSpace(cfg.Token) == "" {
		return nil, fmt.Errorf("token is required")
	}
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return nil, fmt.Errorf("baseURL is required")
	}
	hc := cfg.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: defaultTimeout}
	}
	initialBackoff := cfg.InitialBackoff
	if initialBackoff <= 0 {
		initialBackoff = 250 * time.Millisecond
	}
	maxBackoff := cfg.MaxBackoff
	if maxBackoff <= 0 {
		maxBackoff = 3 * time.Second
	}
	rps := cfg.RateLimitRPS
	if rps == 0 {
		rps = defaultRateLimitRPS
	}

	var limiter *rateLimiter
	if rps > 0 {
		limiter = newRateLimiter(rps)
	}

	return &Client{
		token:          strings.TrimSpace(cfg.Token),
		baseURL:        strings.TrimRight(cfg.BaseURL, "/"),
		httpClient:     hc,
		maxRetries:     cfg.MaxRetries,
		initialBackoff: initialBackoff,
		maxBackoff:     maxBackoff,
		limiter:        limiter,
	}, nil
}

type APIError struct {
	Code        string         `json:"code,omitempty"`
	Message     string         `json:"message,omitempty"`
	Description string         `json:"description,omitempty"`
	Details     map[string]any `json:"details,omitempty"`
	StatusCode  int
	Body        string
	RetryAfter  time.Duration
}

func (e *APIError) Error() string {
	msg := strings.TrimSpace(e.Message)
	if msg == "" {
		msg = strings.TrimSpace(e.Description)
	}
	if msg == "" {
		msg = strings.TrimSpace(e.Body)
	}
	if msg == "" {
		msg = "request failed"
	}
	if e.Code != "" {
		return fmt.Sprintf("max api error: status=%d code=%s message=%s", e.StatusCode, e.Code, msg)
	}
	return fmt.Sprintf("max api error: status=%d message=%s", e.StatusCode, msg)
}

type GetUpdatesOptions struct {
	Offset  int64
	Limit   int
	Timeout int
}

func (c *Client) GetUpdates(ctx context.Context, opts GetUpdatesOptions) ([]Update, error) {
	q := url.Values{}
	if opts.Offset > 0 {
		q.Set("offset", strconv.FormatInt(opts.Offset, 10))
	}
	if opts.Limit > 0 {
		q.Set("limit", strconv.Itoa(opts.Limit))
	}
	if opts.Timeout > 0 {
		q.Set("timeout", strconv.Itoa(opts.Timeout))
	}
	path := "/updates"
	if qs := q.Encode(); qs != "" {
		path += "?" + qs
	}
	body, err := c.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	var wrapped struct {
		Updates []Update `json:"updates"`
	}
	if err := json.Unmarshal(body, &wrapped); err == nil && wrapped.Updates != nil {
		return wrapped.Updates, nil
	}
	var updates []Update
	if err := json.Unmarshal(body, &updates); err != nil {
		return nil, fmt.Errorf("decode updates response: %w", err)
	}
	return updates, nil
}

func (c *Client) SendMessage(ctx context.Context, req SendMessageRequest) error {
	_, err := c.do(ctx, http.MethodPost, "/messages", req)
	return err
}

func (c *Client) UploadMedia(ctx context.Context, req UploadMediaRequest) (*UploadMediaResponse, error) {
	if len(req.Data) == 0 {
		return nil, fmt.Errorf("upload media: data is required")
	}
	filename := strings.TrimSpace(req.Filename)
	if filename == "" {
		filename = "upload.bin"
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	partHeader := make(textproto.MIMEHeader)
	partHeader.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
	contentType := strings.TrimSpace(req.ContentType)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	partHeader.Set("Content-Type", contentType)

	part, err := writer.CreatePart(partHeader)
	if err != nil {
		return nil, fmt.Errorf("upload media: create multipart part: %w", err)
	}
	if _, err := part.Write(req.Data); err != nil {
		return nil, fmt.Errorf("upload media: write multipart data: %w", err)
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("upload media: close multipart writer: %w", err)
	}

	respBody, err := c.doRequest(ctx, http.MethodPost, "/media/upload", body.Bytes(), writer.FormDataContentType())
	if err != nil {
		return nil, err
	}

	var uploaded UploadMediaResponse
	if err := json.Unmarshal(respBody, &uploaded); err == nil && (uploaded.MediaID != "" || uploaded.FileID != "") {
		return &uploaded, nil
	}

	var wrapped struct {
		Media UploadMediaResponse `json:"media"`
	}
	if err := json.Unmarshal(respBody, &wrapped); err != nil {
		return nil, fmt.Errorf("decode upload media response: %w", err)
	}
	return &wrapped.Media, nil
}

func (c *Client) SendMedia(ctx context.Context, req SendMediaRequest) error {
	_, err := c.do(ctx, http.MethodPost, "/messages/media", req)
	return err
}

func (c *Client) do(ctx context.Context, method, path string, payload any) ([]byte, error) {
	var payloadBytes []byte
	var contentType string
	if payload != nil {
		buf := &bytes.Buffer{}
		if err := json.NewEncoder(buf).Encode(payload); err != nil {
			return nil, fmt.Errorf("encode payload: %w", err)
		}
		payloadBytes = buf.Bytes()
		contentType = "application/json"
	}
	return c.doRequest(ctx, method, path, payloadBytes, contentType)
}

func (c *Client) doRequest(ctx context.Context, method, path string, payloadBytes []byte, contentType string) ([]byte, error) {
	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if c.limiter != nil {
			if err := c.limiter.Wait(ctx); err != nil {
				return nil, err
			}
		}

		var bodyReader io.Reader
		if len(payloadBytes) > 0 {
			bodyReader = bytes.NewReader(payloadBytes)
		}

		req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
		if err != nil {
			return nil, fmt.Errorf("build request: %w", err)
		}
		req.Header.Set("Authorization", c.token)
		req.Header.Set("Accept", "application/json")
		if strings.TrimSpace(contentType) != "" {
			req.Header.Set("Content-Type", contentType)
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			if isContextError(err) {
				return nil, err
			}
			lastErr = fmt.Errorf("request failed: %w", err)
			if attempt == c.maxRetries {
				return nil, lastErr
			}
			if err := sleepWithContext(ctx, c.retryBackoff(attempt)); err != nil {
				return nil, err
			}
			continue
		}

		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return nil, fmt.Errorf("read response: %w", readErr)
		}

		if resp.StatusCode < http.StatusBadRequest {
			return body, nil
		}

		apiErr := parseAPIError(resp.StatusCode, resp.Header.Get("Retry-After"), body)
		lastErr = apiErr

		if !shouldRetryStatus(resp.StatusCode) || attempt == c.maxRetries {
			return nil, apiErr
		}

		delay := c.retryBackoff(attempt)
		if apiErr.RetryAfter > 0 {
			delay = apiErr.RetryAfter
		}
		if err := sleepWithContext(ctx, delay); err != nil {
			return nil, err
		}
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("request failed")
}

func parseAPIError(statusCode int, retryAfter string, body []byte) *APIError {
	errObj := &APIError{
		StatusCode: statusCode,
		Body:       strings.TrimSpace(string(body)),
		RetryAfter: parseRetryAfter(retryAfter),
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return errObj
	}
	if v, ok := payload["code"].(string); ok {
		errObj.Code = v
	}
	if v, ok := payload["message"].(string); ok {
		errObj.Message = v
	}
	if v, ok := payload["description"].(string); ok {
		errObj.Description = v
	}
	if v, ok := payload["error"].(string); ok && errObj.Message == "" {
		errObj.Message = v
	}
	if v, ok := payload["details"].(map[string]any); ok {
		errObj.Details = v
	}
	return errObj
}

func (c *Client) retryBackoff(attempt int) time.Duration {
	delay := float64(c.initialBackoff) * math.Pow(2, float64(attempt))
	if delay > float64(c.maxBackoff) {
		return c.maxBackoff
	}
	return time.Duration(delay)
}

func shouldRetryStatus(statusCode int) bool {
	if statusCode == http.StatusTooManyRequests || statusCode == http.StatusRequestTimeout {
		return true
	}
	return statusCode >= http.StatusInternalServerError
}

func parseRetryAfter(v string) time.Duration {
	v = strings.TrimSpace(v)
	if v == "" {
		return 0
	}
	seconds, err := strconv.Atoi(v)
	if err != nil || seconds <= 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
}

func sleepWithContext(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func isContextError(err error) bool {
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}

type rateLimiter struct {
	mu       sync.Mutex
	interval time.Duration
	last     time.Time
}

func newRateLimiter(rps int) *rateLimiter {
	if rps <= 0 {
		return nil
	}
	interval := time.Second / time.Duration(rps)
	if interval <= 0 {
		interval = time.Nanosecond
	}
	return &rateLimiter{interval: interval}
}

func (r *rateLimiter) Wait(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	if r.last.IsZero() {
		r.last = now
		return nil
	}
	next := r.last.Add(r.interval)
	if !next.After(now) {
		r.last = now
		return nil
	}
	wait := next.Sub(now)
	if err := sleepWithContext(ctx, wait); err != nil {
		return err
	}
	r.last = time.Now()
	return nil
}
