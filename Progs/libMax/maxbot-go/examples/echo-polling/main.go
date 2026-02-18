package main

import (
	"context"
	"log"
	"os"

	maxbot "github.com/libmax/maxbot-go"
)

func main() {
	token := os.Getenv("BOT_TOKEN")
	if token == "" {
		log.Fatal("BOT_TOKEN is required")
	}

	baseURL := os.Getenv("MAX_API_BASE_URL")
	if baseURL == "" {
		baseURL = "https://platform-api.max.ru"
	}

	client, err := maxbot.NewClient(maxbot.ClientConfig{
		Token:   token,
		BaseURL: baseURL,
	})
	if err != nil {
		log.Fatal(err)
	}

	bot := maxbot.NewBot(client)
	bot.HandleCommand("start", func(c *maxbot.Context) error {
		return c.Reply("Привет. Отправь любой текст, и я его повторю.")
	})
	bot.HandleText(func(c *maxbot.Context) error {
		return c.Reply("echo: " + c.MessageText())
	})

	if err := bot.StartLongPolling(context.Background()); err != nil {
		log.Fatal(err)
	}
}
