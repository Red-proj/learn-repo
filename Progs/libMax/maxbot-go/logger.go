package maxbot

import "log"

// Logger is a minimal leveled logging contract used by bot runtimes.
type Logger interface {
	Debugf(format string, args ...any)
	Infof(format string, args ...any)
	Errorf(format string, args ...any)
}

// NopLogger disables logs.
type NopLogger struct{}

func (NopLogger) Debugf(string, ...any) {}
func (NopLogger) Infof(string, ...any)  {}
func (NopLogger) Errorf(string, ...any) {}

// StdLogger adapts the standard library logger to the Logger interface.
type StdLogger struct {
	L *log.Logger
}

func NewStdLogger(l *log.Logger) Logger {
	if l == nil {
		return NopLogger{}
	}
	return &StdLogger{L: l}
}

func (s *StdLogger) Debugf(format string, args ...any) {
	s.L.Printf("DEBUG "+format, args...)
}

func (s *StdLogger) Infof(format string, args ...any) {
	s.L.Printf("INFO "+format, args...)
}

func (s *StdLogger) Errorf(format string, args ...any) {
	s.L.Printf("ERROR "+format, args...)
}
