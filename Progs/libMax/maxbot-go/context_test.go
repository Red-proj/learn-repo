package maxbot

import "testing"

func TestContextMessageHelpers(t *testing.T) {
	c := &Context{
		Update: Update{
			Message: &Message{
				Chat: Chat{ID: ID("42")},
				Text: " /start test ",
			},
		},
	}

	if !c.HasMessage() {
		t.Fatal("expected HasMessage true")
	}
	if c.HasCallback() {
		t.Fatal("expected HasCallback false")
	}
	if got := c.MessageText(); got != "/start test" {
		t.Fatalf("unexpected MessageText: %q", got)
	}
	if got := c.Command(); got != "start" {
		t.Fatalf("unexpected Command: %q", got)
	}
	if !c.IsCommand("start") {
		t.Fatal("expected IsCommand(start) true")
	}
	if !c.IsCommand("/START") {
		t.Fatal("expected IsCommand(/START) true")
	}
	if got := c.ChatID(); got != ID("42") {
		t.Fatalf("unexpected ChatID: %q", got)
	}
}

func TestContextCallbackHelpers(t *testing.T) {
	c := &Context{
		Update: Update{
			Callback: &CallbackQuery{
				Data: " click_me ",
				Chat: &Chat{ID: ID("99")},
			},
		},
	}

	if c.HasMessage() {
		t.Fatal("expected HasMessage false")
	}
	if !c.HasCallback() {
		t.Fatal("expected HasCallback true")
	}
	if got := c.CallbackData(); got != "click_me" {
		t.Fatalf("unexpected CallbackData: %q", got)
	}
	if got := c.ChatID(); got != ID("99") {
		t.Fatalf("unexpected ChatID: %q", got)
	}
}

func TestContextChatIDFromCallbackMessageFallback(t *testing.T) {
	c := &Context{
		Update: Update{
			Callback: &CallbackQuery{
				Msg: &Message{Chat: Chat{ID: ID("77")}},
			},
		},
	}

	if got := c.ChatID(); got != ID("77") {
		t.Fatalf("unexpected ChatID: %q", got)
	}
}

func TestContextEmptyCases(t *testing.T) {
	c := &Context{}

	if c.HasMessage() || c.HasCallback() {
		t.Fatal("expected empty context flags to be false")
	}
	if c.MessageText() != "" {
		t.Fatal("expected empty MessageText")
	}
	if c.CallbackData() != "" {
		t.Fatal("expected empty CallbackData")
	}
	if c.Command() != "" {
		t.Fatal("expected empty Command")
	}
	if c.IsCommand("start") {
		t.Fatal("expected IsCommand false")
	}
	if c.ChatID() != "" {
		t.Fatal("expected empty ChatID")
	}
}
