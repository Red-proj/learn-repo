///Генерация студента

#include "lib8.h"

const char* names[] = {"Konstantin", "Sergey", "Kseniya", 
                      "Vladislav", "Petr", "Egor", 
					  "Mark", "Daniil", "Anna"}; 

const int groups[] = {121, 122, 123, 124, 125, 126}; 
const int groups_count = sizeof(groups) / sizeof(groups[0]);

Student generate_random_student(void) 
{
    Student s;
    const char* name;
    int name_index;
    
    name_index = rand() % (sizeof(names) / sizeof(names[0]));
    name = names[name_index];
    
    s.Name = malloc(strlen(name) + 1);
    strcpy(s.Name, name);
    
	//Группа сейчас берется из списка, но в целом можно ещё вот так задать
    //s.Group = 100 + rand() % 30;
    s.Group = groups[rand() % groups_count];
	
	//Рейтинг от одного до пяти с шагом в 0.5
    s.Rating = 1.0 + (rand() % 9) / 2.0;
    
    return s;
}

void generate_file_of_students(const char *fname, int count)
{
    Student student;
    FILE* f = fopen(fname, "w");
    if(!f){perror("Error openning file for writing"); return;}
    
    for(int i=0; i<count; i++)
    {
        student = generate_random_student();
        write_student(f, &student);
        free_student(&student);
    }
    fclose(f);
}

Student* read_students_from_file(const char * fname, int* count)
{
    char line[256];
    Student* students;
    
    FILE* f = fopen(fname, "r");
    if(!f){perror("Error openning file for reading"); return NULL;}
    
    *count = 0;
    while(fgets(line, sizeof(line), f)) (*count)++;
    
    students = malloc(*count * sizeof(Student));
    if(!students){fclose(f); return NULL;}
    
    rewind(f);
    for(int i=0; i<*count; i++) if(!read_student(f, &students[i])) {free_students(students,i); fclose(f); return NULL;}
    
    fclose(f);
    return students;
}
