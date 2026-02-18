package maxbot

import (
	"context"
	"strings"
)

type Context struct {
	ctx    context.Context
	Client *Client
	Update Update
}

func (c *Context) Context() context.Context {
	return c.ctx
}

func (c *Context) Message() *Message {
	return c.Update.Message
}

func (c *Context) Callback() *CallbackQuery {
	return c.Update.Callback
}

func (c *Context) HasMessage() bool {
	return c.Update.Message != nil
}

func (c *Context) HasCallback() bool {
	return c.Update.Callback != nil
}

func (c *Context) MessageText() string {
	if c.Update.Message == nil {
		return ""
	}
	return strings.TrimSpace(c.Update.Message.Text)
}

func (c *Context) CallbackData() string {
	if c.Update.Callback == nil {
		return ""
	}
	return strings.TrimSpace(c.Update.Callback.Data)
}

func (c *Context) Command() string {
	if c.Update.Message == nil {
		return ""
	}
	return c.Update.Message.Command()
}

func (c *Context) IsCommand(cmd string) bool {
	cmd = strings.TrimPrefix(strings.TrimSpace(strings.ToLower(cmd)), "/")
	if cmd == "" {
		return false
	}
	return c.Command() == cmd
}

func (c *Context) ChatID() ID {
	if c.Update.Message != nil {
		return c.Update.Message.Chat.ID
	}
	if c.Update.Callback != nil {
		if c.Update.Callback.Chat != nil {
			return c.Update.Callback.Chat.ID
		}
		if c.Update.Callback.Msg != nil {
			return c.Update.Callback.Msg.Chat.ID
		}
	}
	return ""
}

func (c *Context) Reply(text string) error {
	chatID := c.ChatID()
	if chatID == "" {
		return nil
	}
	return c.Client.SendMessage(c.ctx, SendMessageRequest{
		ChatID: chatID,
		Text:   text,
	})
}
