package maxbot

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestClientRetriesOn5xxThenSucceeds(t *testing.T) {
	var calls int32
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/updates" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		n := atomic.AddInt32(&calls, 1)
		if n < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"message":"temporary"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"updates":[]}`))
	}))
	defer ts.Close()

	c, err := NewClient(ClientConfig{
		Token:          "test-token",
		BaseURL:        ts.URL,
		MaxRetries:     2,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     2 * time.Millisecond,
		RateLimitRPS:   -1,
	})
	if err != nil {
		t.Fatalf("NewClient error: %v", err)
	}

	updates, err := c.GetUpdates(context.Background(), GetUpdatesOptions{})
	if err != nil {
		t.Fatalf("GetUpdates error: %v", err)
	}
	if len(updates) != 0 {
		t.Fatalf("expected 0 updates, got %d", len(updates))
	}
	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Fatalf("expected 3 attempts, got %d", got)
	}
}

func TestClientStopsAfterMaxRetries(t *testing.T) {
	var calls int32
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"code":"internal_error","message":"boom"}`))
	}))
	defer ts.Close()

	c, err := NewClient(ClientConfig{
		Token:          "test-token",
		BaseURL:        ts.URL,
		MaxRetries:     1,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     time.Millisecond,
		RateLimitRPS:   -1,
	})
	if err != nil {
		t.Fatalf("NewClient error: %v", err)
	}

	_, err = c.GetUpdates(context.Background(), GetUpdatesOptions{})
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", apiErr.StatusCode)
	}
	if apiErr.Code != "internal_error" {
		t.Fatalf("expected code internal_error, got %q", apiErr.Code)
	}
	if got := atomic.LoadInt32(&calls); got != 2 {
		t.Fatalf("expected 2 attempts, got %d", got)
	}
}

func TestClientUsesRetryAfterOn429(t *testing.T) {
	var calls int32
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&calls, 1)
		if n == 1 {
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"message":"slow down"}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"updates":[]}`))
	}))
	defer ts.Close()

	c, err := NewClient(ClientConfig{
		Token:          "test-token",
		BaseURL:        ts.URL,
		MaxRetries:     1,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     time.Millisecond,
		RateLimitRPS:   -1,
	})
	if err != nil {
		t.Fatalf("NewClient error: %v", err)
	}

	start := time.Now()
	_, err = c.GetUpdates(context.Background(), GetUpdatesOptions{})
	if err != nil {
		t.Fatalf("GetUpdates error: %v", err)
	}
	elapsed := time.Since(start)
	if elapsed < 900*time.Millisecond {
		t.Fatalf("expected retry-after delay close to 1s, got %s", elapsed)
	}
	if got := atomic.LoadInt32(&calls); got != 2 {
		t.Fatalf("expected 2 attempts, got %d", got)
	}
}

func TestClientRetriesTransportErrors(t *testing.T) {
	failures := int32(2)
	h := roundTripperFunc(func(*http.Request) (*http.Response, error) {
		if atomic.AddInt32(&failures, -1) >= 0 {
			return nil, fmt.Errorf("temporary network error")
		}
		resp := &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"updates":[]}`)),
		}
		return resp, nil
	})

	c, err := NewClient(ClientConfig{
		Token:          "test-token",
		BaseURL:        "https://example.test",
		HTTPClient:     &http.Client{Transport: h},
		MaxRetries:     2,
		InitialBackoff: time.Millisecond,
		MaxBackoff:     2 * time.Millisecond,
		RateLimitRPS:   -1,
	})
	if err != nil {
		t.Fatalf("NewClient error: %v", err)
	}

	_, err = c.GetUpdates(context.Background(), GetUpdatesOptions{})
	if err != nil {
		t.Fatalf("GetUpdates error: %v", err)
	}
}

func TestUploadMediaSendsMultipartRequest(t *testing.T) {
	var gotAuth string
	var gotContentType string
	var gotBody string

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/media/upload" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		gotAuth = r.Header.Get("Authorization")
		gotContentType = r.Header.Get("Content-Type")
		raw, _ := io.ReadAll(r.Body)
		gotBody = string(raw)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"media_id":"m1","url":"https://cdn.example/m1"}`))
	}))
	defer ts.Close()

	c, err := NewClient(ClientConfig{
		Token:        "test-token",
		BaseURL:      ts.URL,
		RateLimitRPS: -1,
	})
	if err != nil {
		t.Fatalf("NewClient error: %v", err)
	}

	resp, err := c.UploadMedia(context.Background(), UploadMediaRequest{
		Filename:    "photo.jpg",
		ContentType: "image/jpeg",
		Data:        []byte("binary-data"),
	})
	if err != nil {
		t.Fatalf("UploadMedia error: %v", err)
	}
	if gotAuth != "test-token" {
		t.Fatalf("unexpected auth header: %q", gotAuth)
	}

	mt, _, err := mime.ParseMediaType(gotContentType)
	if err != nil {
		t.Fatalf("invalid content-type: %v", err)
	}
	if mt != "multipart/form-data" {
		t.Fatalf("expected multipart/form-data, got %q", mt)
	}
	if !strings.Contains(gotBody, `name="file"; filename="photo.jpg"`) {
		t.Fatalf("multipart body does not contain file disposition: %q", gotBody)
	}
	if !strings.Contains(gotBody, "binary-data") {
		t.Fatalf("multipart body does not contain upload content: %q", gotBody)
	}
	if resp == nil || resp.MediaID != "m1" {
		t.Fatalf("unexpected upload response: %+v", resp)
	}
}

func TestSendMediaSendsExpectedJSON(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/messages/media" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Fatalf("unexpected content-type: %q", ct)
		}
		raw, _ := io.ReadAll(r.Body)
		var payload SendMediaRequest
		if err := json.Unmarshal(raw, &payload); err != nil {
			t.Fatalf("invalid json payload: %v", err)
		}
		if payload.ChatID != "42" || payload.MediaID != "m1" || payload.Caption != "hello" || payload.Type != "image" {
			t.Fatalf("unexpected payload: %+v", payload)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer ts.Close()

	c, err := NewClient(ClientConfig{
		Token:        "test-token",
		BaseURL:      ts.URL,
		RateLimitRPS: -1,
	})
	if err != nil {
		t.Fatalf("NewClient error: %v", err)
	}

	if err := c.SendMedia(context.Background(), SendMediaRequest{
		ChatID:  "42",
		MediaID: "m1",
		Caption: "hello",
		Type:    "image",
	}); err != nil {
		t.Fatalf("SendMedia error: %v", err)
	}
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}
