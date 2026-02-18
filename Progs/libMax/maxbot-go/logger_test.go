package maxbot

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"
)

func TestStdLoggerPrefixes(t *testing.T) {
	var out bytes.Buffer
	l := NewStdLogger(log.New(&out, "", 0))

	l.Debugf("debug %d", 1)
	l.Infof("info %d", 2)
	l.Errorf("error %d", 3)

	got := out.String()
	if !strings.Contains(got, "DEBUG debug 1") {
		t.Fatalf("missing debug log, got: %q", got)
	}
	if !strings.Contains(got, "INFO info 2") {
		t.Fatalf("missing info log, got: %q", got)
	}
	if !strings.Contains(got, "ERROR error 3") {
		t.Fatalf("missing error log, got: %q", got)
	}
}

func TestWithLoggerUsesCustomLogger(t *testing.T) {
	var out bytes.Buffer
	custom := NewStdLogger(log.New(&out, "", 0))

	b := NewBot(&Client{}, WithLogger(custom))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := b.StartLongPolling(ctx); err == nil {
		t.Fatal("expected context canceled error, got nil")
	}

	if !strings.Contains(out.String(), "long polling started") || !strings.Contains(out.String(), "long polling stopped") {
		t.Fatalf("expected custom logger output, got: %q", out.String())
	}
}
