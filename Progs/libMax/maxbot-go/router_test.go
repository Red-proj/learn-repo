package maxbot

import (
	"context"
	"testing"
)

func TestRouterDispatchesCommandFirst(t *testing.T) {
	r := NewRouter()
	called := ""
	r.HandleCommand("start", func(c *Context) error {
		called = "command"
		return nil
	})
	r.HandleText(func(c *Context) error {
		called = "text"
		return nil
	})

	err := r.Dispatch(context.Background(), nil, Update{
		Message: &Message{Text: "/start hello"},
	})
	if err != nil {
		t.Fatalf("dispatch error: %v", err)
	}
	if called != "command" {
		t.Fatalf("expected command handler, got %q", called)
	}
}

func TestRouterMiddlewareOrder(t *testing.T) {
	r := NewRouter()
	chain := ""
	r.Use(func(next Handler) Handler {
		return func(c *Context) error {
			chain += "A"
			err := next(c)
			chain += "a"
			return err
		}
	})
	r.Use(func(next Handler) Handler {
		return func(c *Context) error {
			chain += "B"
			err := next(c)
			chain += "b"
			return err
		}
	})
	r.HandleText(func(c *Context) error {
		chain += "H"
		return nil
	})

	err := r.Dispatch(context.Background(), nil, Update{Message: &Message{Text: "hi"}})
	if err != nil {
		t.Fatalf("dispatch error: %v", err)
	}
	if chain != "ABHba" {
		t.Fatalf("unexpected middleware order: %q", chain)
	}
}
