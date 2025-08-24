#include "tree.h"

// Создание дерева с заданным корневым элементом
Tree* createTree(const char *value) 
{
	TreeNode *node;
    Tree *tree = (Tree*)malloc(sizeof(Tree));
    if (tree == NULL) {
        return NULL;
    }
    
    node = (TreeNode*)malloc(sizeof(TreeNode));
    if (node == NULL) 
	{
        free(tree);
        return NULL;
    }
    
    node->value = strdup(value);
    node->parent = NULL;
    node->left = NULL;
    node->right = NULL;
    
    tree->root = node;
    tree->current = node;
    
    return tree;
}

// Рекурсивная функция для освобождения памяти узла и его потомков
void freeNode(TreeNode *node) 
{
    if (node == NULL) return;
    
    freeNode(node->left);
    freeNode(node->right);
    free(node->value);
    free(node);
}

// Очистка всего дерева
void clearTree(Tree *tree) 
{
    if (tree == NULL) return;
    
    freeNode(tree->root);
    tree->root = NULL;
    tree->current = NULL;
	free(tree);
}

// Добавление правого потомка к текущему узлу
void addRightChild(Tree *tree, const char *value) 
{
	TreeNode *node;
    if (tree == NULL || tree->current == NULL) return;
    
    if (tree->current->right != NULL) 
	{
        printf("Правый потомок уже существует!\n");
        return;
    }
    
    node = (TreeNode*)malloc(sizeof(TreeNode));
    if (node == NULL) return;
    
    node->value = strdup(value);
    node->parent = tree->current;
    node->left = NULL;
    node->right = NULL;
    
    tree->current->right = node;
}

// Добавление левого потомка к текущему узлу
void addLeftChild(Tree *tree, const char *value) 
{
	TreeNode *node;
    if (tree == NULL || tree->current == NULL) return;
    if (tree->current->left != NULL) 
	{
        printf("Левый потомок уже существует!\n");
        return;
    }
    
    node = (TreeNode*)malloc(sizeof(TreeNode));
    if (node == NULL) return;
    
    node->value = strdup(value);
    node->parent = tree->current;
    node->left = NULL;
    node->right = NULL;
    
    tree->current->left = node;
}

// Удаление правого поддерева текущего узла
void deleteRightSubtree(Tree *tree) 
{
    if (tree == NULL || tree->current == NULL || tree->current->right == NULL) return;
    
    freeNode(tree->current->right);
    tree->current->right = NULL;
}

// Удаление левого поддерева текущего узла
void deleteLeftSubtree(Tree *tree) 
{
    if (tree == NULL || tree->current == NULL || tree->current->left == NULL) return;
    
    freeNode(tree->current->left);
    tree->current->left = NULL;
}

// Перемещение текущего элемента на родителя
void moveToParent(Tree *tree) 
{
    if (tree == NULL || tree->current == NULL || tree->current->parent == NULL) return;
    
    tree->current = tree->current->parent;
}

// Перемещение текущего элемента на правого потомка
void moveToRightChild(Tree *tree) 
{
    if (tree == NULL || tree->current == NULL || tree->current->right == NULL) return;
    
    tree->current = tree->current->right;
}

// Перемещение текущего элемента на левого потомка
void moveToLeftChild(Tree *tree) 
{
    if (tree == NULL || tree->current == NULL || tree->current->left == NULL) return;
    
    tree->current = tree->current->left;
}

// Рекурсивная функция для печати дерева
void printTreeRec(TreeNode *node, int depth) 
{
    if (node == NULL) return;
    
    printTreeRec(node->left, depth + 1);
    
    for (int k = 0; k < depth; k++) printf("\t");
    printf("%s\n", node->value);
    
    printTreeRec(node->right, depth + 1);
}

// Печать всего дерева
void printTree(Tree *tree) 
{
    if (tree == NULL) return;
    
    printf("Дерево (текущий узел: %s):\n", 
           tree->current ? tree->current->value : "NULL");
    printTreeRec(tree->root, 0);
    printf("\n");
}