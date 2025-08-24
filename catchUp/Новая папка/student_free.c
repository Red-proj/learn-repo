///Функции освобождения памяти 

#include "lib8.h"

void free_student(Student* student) 
{
    free(student->Name);
}

void free_students(Student* students, int count) 
{    
	for (int i = 0; i < count; i++) free(students[i].Name);
    free(students);
}