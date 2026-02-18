package maxbot

import (
	"context"
	"strings"
)

type Handler func(*Context) error
type Middleware func(Handler) Handler

type Router struct {
	commands    map[string]Handler
	onText      Handler
	onCallback  Handler
	middlewares []Middleware
}

func NewRouter() *Router {
	return &Router{
		commands: make(map[string]Handler),
	}
}

func (r *Router) Use(mw Middleware) {
	r.middlewares = append(r.middlewares, mw)
}

func (r *Router) HandleCommand(cmd string, handler Handler) {
	cmd = strings.TrimPrefix(strings.TrimSpace(strings.ToLower(cmd)), "/")
	if cmd == "" || handler == nil {
		return
	}
	r.commands[cmd] = handler
}

func (r *Router) HandleText(handler Handler) {
	r.onText = handler
}

func (r *Router) HandleCallback(handler Handler) {
	r.onCallback = handler
}

func (r *Router) Dispatch(ctx context.Context, client *Client, upd Update) error {
	c := &Context{
		ctx:    ctx,
		Client: client,
		Update: upd,
	}
	if upd.Message != nil {
		if cmd := upd.Message.Command(); cmd != "" {
			if h, ok := r.commands[cmd]; ok {
				return chain(r.middlewares, h)(c)
			}
		}
		if r.onText != nil {
			return chain(r.middlewares, r.onText)(c)
		}
		return nil
	}
	if upd.Callback != nil && r.onCallback != nil {
		return chain(r.middlewares, r.onCallback)(c)
	}
	return nil
}

func chain(middlewares []Middleware, final Handler) Handler {
	if final == nil {
		return func(*Context) error { return nil }
	}
	h := final
	for i := len(middlewares) - 1; i >= 0; i-- {
		h = middlewares[i](h)
	}
	return h
}
