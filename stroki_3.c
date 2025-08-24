#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdlib.h>

#define MAX_WORD_LENGTH 512
#define MAX_LINE_LENGTH 512

int is_uppercase_english_only(const char *word);
int starts_with_a(const char *word);
int is_delimiter(char c);
int process_line(const char *line, char *current_shortest);
int search(const char *SinputFile, char *word);

// Функция проверки, состоит ли слово только из заглавных английских букв
int is_uppercase_english_only(const char *word) {
    if (word == NULL || *word == '\0') {
        return 0;
    }
    
    for (int i = 0; word[i] != '\0'; i++) {
        if (!(word[i] >= 'A' && word[i] <= 'Z')) {
            return 0;
        }
    }
    return 1;
}

// Функция проверки, начинается ли слово на букву 'A'
int starts_with_a(const char *word) 
{
    if (word == NULL || *word == '\0') {
        return 0;
    }
    return (word[0] == 'A');
}

// Функция проверки, является ли символ разделителем
int is_delimiter(char c) {
    return c == ' ' || c == '.' || c == ',';
}

// Функция извлечения слов из строки и поиска подходящего
int process_line(const char *line, char *current_shortest) {
    int line_length = strlen(line);
    char word[MAX_WORD_LENGTH];
    int word_start = -1;
    int found = 0;
    
    for (int i = 0; i <= line_length; i++) {
        // Если текущий символ - разделитель или конец строки
        if (i == line_length || is_delimiter(line[i])) {
            // Если мы находимся внутри слова
            if (word_start != -1) {
                int word_length = i - word_start;
                
                // Копируем слово во временный буфер
                strncpy(word, line + word_start, word_length);
                word[word_length] = '\0';
                
                // Проверяем условия: только заглавные английские буквы и начинается на 'A'
                if (is_uppercase_english_only(word) && starts_with_a(word)) {
                    // Если это первое найденное подходящее слово или оно короче текущего самого короткого
                    if (!found || word_length < strlen(current_shortest)) {
                        strcpy(current_shortest, word);
                        found = 1;
                    }
                }
                
                word_start = -1; // Сбрасываем начало слова
            }
        }
        // Если текущий символ не разделитель и мы не внутри слова
        else if (word_start == -1) {
            word_start = i; // Начинаем новое слово
        }
    }
    
    return found;
}

// Основная функция поиска
int search(const char *SinputFile, char *word) {
    FILE *file = fopen(SinputFile, "r");
    if (file == NULL) {
        return -1; // Файл не удалось открыть
    }
    
    char line[MAX_LINE_LENGTH];
    char shortest_word[MAX_WORD_LENGTH] = ""; // Инициализируем пустой строкой
    int found_any = 0;
    
    // Читаем файл построчно
    while (fgets(line, sizeof(line), file)) {
        // Удаляем символ новой строки, если он есть
        line[strcspn(line, "\n")] = '\0';
        
        // Обрабатываем строку
        if (process_line(line, shortest_word)) {
            found_any = 1;
        }
    }
    
    fclose(file);
    
    // Если нашли подходящее слово, копируем его в выходной параметр
    if (found_any) {
        strcpy(word, shortest_word);
    } else {
        word[0] = '\0'; // Возвращаем пустую строку, если не нашли слов
    }
    
    return 0; // Успешное выполнение
}

// Дополнительная функция для тестирования
int main() 
{
    char result[MAX_WORD_LENGTH];
    
    // Тестирование функции
    int status = search("input.txt", result);
    
    if (status == -1) {
        printf("Ошибка открытия файла\n");
        return 1;
    }
    
    if (strlen(result) > 0) {
        printf("Самое короткое слово: %s\n", result);
    } else {
        printf("Подходящих слов не найдено\n");
    }
    
    return 0;
}
