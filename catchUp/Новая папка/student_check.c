///Проверка студента на то, что ему остро необходимо
///отчислиться и стать кошачьей няней для улучшения 
///самочувствия, а также профилактики стрессов, болезней 
///и ожесточения под давлением социума

#include "lib8.h"

int is_valid_expel(const Student* expel, Student* all_students, int all_count, double R)
{
    for (int j = 0; j < all_count; j++) 
	{
        if (strcmp(expel->Name, all_students[j].Name) == 0 && 
            expel->Group == all_students[j].Group &&
            fabs(expel->Rating - all_students[j].Rating) < eps) 
        {
            return (expel->Rating <= R);
        }
    }
    return 0;
}

void check_expel_student(FILE* output, Student* all_students, int all_count, const Student* expel, double R) 
{
    if (!is_valid_expel(expel, all_students, all_count, R))
        write_student(output, expel);
}

int count_invalid_candidates(Student* expel_list, int expel_count, Student* all_students, int all_count, double R) 
{
    int invalid = 0;
    for (int i = 0; i < expel_count; i++) {
        if (!is_valid_expel(&expel_list[i], all_students, all_count, R))
            invalid++;
    }
    return invalid;
}