package maxbot

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWebhookMethodNotAllowed(t *testing.T) {
	b := NewBot(&Client{})
	h := b.webhookHandler()

	req := httptest.NewRequest(http.MethodGet, "/webhook", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rr.Code)
	}
}

func TestWebhookInvalidPayload(t *testing.T) {
	b := NewBot(&Client{})
	h := b.webhookHandler()

	req := httptest.NewRequest(http.MethodPost, "/webhook", strings.NewReader("{"))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestWebhookDispatchesUpdate(t *testing.T) {
	b := NewBot(&Client{})
	called := false
	b.HandleCommand("start", func(c *Context) error {
		called = true
		return nil
	})
	h := b.webhookHandler()

	req := httptest.NewRequest(http.MethodPost, "/webhook", strings.NewReader(`{"update_id":1,"message":{"text":"/start"}}`))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	if !called {
		t.Fatal("expected handler to be called")
	}
}

func TestWebhookReturns500OnHandlerError(t *testing.T) {
	b := NewBot(&Client{})
	b.HandleText(func(c *Context) error {
		return errors.New("boom")
	})
	h := b.webhookHandler()

	req := httptest.NewRequest(http.MethodPost, "/webhook", strings.NewReader(`{"update_id":1,"message":{"text":"hello"}}`))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rr.Code)
	}
}
