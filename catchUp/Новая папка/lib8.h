#ifndef LIB8_H
#define LIB8_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>

#define eps 1.e-14

typedef struct 
{
    char* Name;
    int Group;
    double Rating;
} Student;

extern const char* names[];

extern const int groups[];
extern const int groups_count;

int read_student(FILE* file, Student* student);
void write_student(FILE* file, const Student* student);

Student generate_random_student(void);
void generate_file_of_students(const char *fname, int count);
Student* read_students_from_file(const char * fname, int* count);

void write_students_to_file(const char* fname, Student* students, int count);
void write_expel_list(const char* fname, Student* expel_students, int expel_count);
void write_valid_expel_list(const char* fname, Student* expel_students, int expel_count, Student* all_students, int all_count, double R);
void write_invalid_expel_list(const char* fname, Student* expel_students, int expel_count, Student* all_students, int all_count, double R);
						  
void free_student(Student* student);
void free_students(Student* students, int count);

void check_expel_student(FILE* output, Student* all_students, int all_count, const Student* expel, double R);
int count_invalid_candidates(Student* expel_list, int expel_count, Student* all_students, int all_count, double R);
int is_valid_expel(const Student* expel, Student* all_students, int all_count, double R);


#endif
