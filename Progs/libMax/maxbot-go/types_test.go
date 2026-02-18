package maxbot

import "testing"

func TestMessageCommand(t *testing.T) {
	cases := []struct {
		text string
		want string
	}{
		{text: "/start", want: "start"},
		{text: " /START@MyBot arg", want: "start"},
		{text: "hello", want: ""},
		{text: "/", want: ""},
	}

	for _, tc := range cases {
		m := &Message{Text: tc.text}
		if got := m.Command(); got != tc.want {
			t.Fatalf("Command(%q) = %q, want %q", tc.text, got, tc.want)
		}
	}
}
