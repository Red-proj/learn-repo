/* Создать тип данных структура Student, содержащую поля: строка Name, целое Group, вещественное Rating. Для создания массива структур Student создать переменную типа Student*. Записать в файл соответствующие данные по студентам (по одному студенту в строке). Загрузить указанные данные в указанный массив структур.  Аналогичным образом создать файл с данными по студентам, которых должны отчислить, загрузить их в массив, созданный также аналогичным образом.
У студентов, которых должны отчислить рейтинг должен быть не больше некоторого R (его можно задать как угодно). Проверить, значится ли студент, которого должны отчислить, в полном списке студентов и то, что его рейтинг ≤ R.
Вывести данные по студентам с некорректными данными в файл в том же формате, что и исходный файл.*/ 

#include "lib8.h"

int main(void) 
{
    Student* all_students;
    Student* expel_students;
    int all_count;
    int expel_count;
    double R;
    char c;

    srand(time(NULL));

    printf("Enter total students count: ");
    scanf("%d", &all_count);
    printf("Enter students to expel count: ");
    scanf("%d", &expel_count);
    printf("Enter expel rating threshold (R): ");
    scanf("%lf", &R);

    generate_file_of_students("all_students.txt", all_count);
    generate_file_of_students("expel_list.txt", expel_count);
    
    scanf("%s", &c);
    
    all_students = read_students_from_file("all_students.txt", &all_count);
    expel_students = read_students_from_file("expel_list.txt", &expel_count);
    
    // Запись в файлы (с заголовками)
	write_students_to_file("all_students.txt", all_students, all_count);
	write_expel_list("expel_list.txt", expel_students, expel_count);
	write_valid_expel_list("valid_expel_list.txt", expel_students, expel_count, 
                      all_students, all_count, R);
	write_invalid_expel_list("incorrect_students.txt", expel_students, expel_count,
                        all_students, all_count, R);


    // Освобождение памяти
    free_students(all_students, all_count);
    free_students(expel_students, expel_count);

    printf("Program completed successfully. Results written to files:\n");
    printf("- all_students.txt (full list)\n");
    printf("- expel_list.txt (expel candidates)\n");
    printf("- incorrect_students.txt (invalid candidates)\n");
	printf("- valid_expel_list.txt (valid candidates)\n");
    
    return 0;
}
