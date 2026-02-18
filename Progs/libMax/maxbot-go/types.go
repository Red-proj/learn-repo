package maxbot

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type ID string

func (id *ID) UnmarshalJSON(data []byte) error {
	if len(data) == 0 {
		*id = ""
		return nil
	}
	if data[0] == '"' {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return err
		}
		*id = ID(s)
		return nil
	}
	var n json.Number
	if err := json.Unmarshal(data, &n); err != nil {
		return fmt.Errorf("decode id: %w", err)
	}
	*id = ID(n.String())
	return nil
}

func (id ID) Int64() (int64, error) {
	return strconv.ParseInt(string(id), 10, 64)
}

type Update struct {
	UpdateID int64          `json:"update_id"`
	Message  *Message       `json:"message,omitempty"`
	Callback *CallbackQuery `json:"callback_query,omitempty"`
}

type User struct {
	ID       ID     `json:"user_id"`
	Username string `json:"username,omitempty"`
	Name     string `json:"name,omitempty"`
}

type Chat struct {
	ID    ID     `json:"chat_id"`
	Title string `json:"title,omitempty"`
	Type  string `json:"type,omitempty"`
}

type Message struct {
	ID     ID     `json:"message_id"`
	Chat   Chat   `json:"chat"`
	Sender *User  `json:"sender,omitempty"`
	Text   string `json:"text,omitempty"`
}

type CallbackQuery struct {
	ID   string   `json:"callback_id"`
	From *User    `json:"from,omitempty"`
	Data string   `json:"data,omitempty"`
	Chat *Chat    `json:"chat,omitempty"`
	Msg  *Message `json:"message,omitempty"`
}

func (m *Message) Command() string {
	if m == nil {
		return ""
	}
	text := strings.TrimSpace(m.Text)
	if !strings.HasPrefix(text, "/") {
		return ""
	}
	text = strings.TrimPrefix(text, "/")
	parts := strings.Fields(text)
	if len(parts) == 0 {
		return ""
	}
	cmd := parts[0]
	if idx := strings.IndexByte(cmd, '@'); idx >= 0 {
		cmd = cmd[:idx]
	}
	return strings.ToLower(strings.TrimSpace(cmd))
}

type SendMessageRequest struct {
	ChatID ID     `json:"chat_id"`
	Text   string `json:"text"`
}

type UploadMediaRequest struct {
	Filename    string
	ContentType string
	Data        []byte
}

type UploadMediaResponse struct {
	MediaID ID     `json:"media_id,omitempty"`
	FileID  ID     `json:"file_id,omitempty"`
	URL     string `json:"url,omitempty"`
}

type SendMediaRequest struct {
	ChatID  ID     `json:"chat_id"`
	MediaID ID     `json:"media_id"`
	Caption string `json:"caption,omitempty"`
	Type    string `json:"type,omitempty"`
}
