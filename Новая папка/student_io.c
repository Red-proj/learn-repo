///Ввод и вывод студентов

#include "lib8.h"

int read_student(FILE* f, Student* student) 
{
    char name[256];
    int read_count;
    
    read_count = fscanf(f, "%255s %d %lf", name, &student->Group, &student->Rating);
    if (read_count != 3) return 0;
    
    student->Name = malloc(strlen(name) + 1);
    strcpy(student->Name, name);
    return 1;
}

void write_student(FILE* f, const Student* student) 
{
    fprintf(f, "%s %d %.1f\n", student->Name, student->Group, student->Rating);
}

void write_students_to_file(const char* fname, Student* students, int count) 
{
    FILE* f = fopen(fname, "w");
    if (!f) {perror("Error opening file"); return;}    
	fprintf(f, "All students (%d)\n", count);
    
    for (int i = 0; i < count; i++) {
        write_student(f, &students[i]);
    }
    
    fclose(f);
}

void write_expel_list(const char* fname, Student* expel_students, int expel_count) 
{
    FILE* f = fopen(fname, "w");
    if (!f) {perror("Error opening expel list file");return;}    
    fprintf(f, "Candidates for expulsion (%d)\n", expel_count);
    for (int i = 0; i < expel_count; i++) write_student(f, &expel_students[i]);
    fclose(f);
}

void write_valid_expel_list(const char* fname, Student* expel_students, int expel_count, Student* all_students, int all_count, double R) 
{
    FILE* f = fopen(fname, "w");    
    int valid_count = 0;
	
    if (!f) {perror("Error opening valid expel list file"); return;}
    fprintf(f, "Valid candidates for expulsion (%d)\n", valid_count);
    
    for (int i = 0; i < expel_count; i++)
        if (is_valid_expel(&expel_students[i], all_students, all_count, R)) 
		{
            write_student(f, &expel_students[i]);
            valid_count++;
        }
    
    rewind(f);
    fprintf(f, "Valid candidates for expulsion (%d)\n", valid_count);
    fclose(f);
}

void write_invalid_expel_list(const char* fname, Student* expel_students, int expel_count, Student* all_students, int all_count, double R)
{
    FILE* f = fopen(fname, "w");
    int invalid_count = 0;
	
    if (!f) {perror("Error opening invalid expel list file"); return;}
    fprintf(f, "Invalid candidates (%d)\n", invalid_count);
    
    for (int i = 0; i < expel_count; i++)
        if (!is_valid_expel(&expel_students[i], all_students, all_count, R)) 
		{
            write_student(f, &expel_students[i]);
            invalid_count++;
        }
    
    rewind(f);
    fprintf(f, "Invalid candidates (%d)\n", invalid_count);
    fclose(f);
}
