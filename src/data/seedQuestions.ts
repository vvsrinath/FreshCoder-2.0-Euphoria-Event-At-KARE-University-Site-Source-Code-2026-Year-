import type { Difficulty, QuestionType } from '../types';

export interface SeedQuestion {
  title: string;
  type: QuestionType;
  topic: string;
  difficulty: Difficulty;
  marks: number;
  prompt: string;
  code?: string;
  options?: string[];
  answer: string;
  alternatives?: string[];
  explanation?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  sampleInput?: string;
  sampleOutput?: string;
  testCases?: {input: string;output: string;}[];
}

/** Development / demo question bank for the Python Fundamentals assessment. */
export const seedQuestions: SeedQuestion[] = [
// ---------------- MCQ ----------------
{
  title: 'Python Input Function',
  type: 'MCQ',
  topic: 'Basics',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Which built-in function reads a line of text from the user in Python 3?',
  options: ['scan()', 'input()', 'read()', 'gets()'],
  answer: '1',
  explanation: 'input() reads a line from stdin and returns it as a string.'
},
{
  title: 'Immutable Data Type',
  type: 'MCQ',
  topic: 'Data Types',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Which of the following Python data types is immutable?',
  options: ['list', 'dict', 'set', 'tuple'],
  answer: '3',
  explanation: 'Tuples cannot be modified after creation.'
},
{
  title: 'Integer Division Operator',
  type: 'MCQ',
  topic: 'Operators',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Which operator performs floor (integer) division?',
  options: ['/', '//', '%', '**'],
  answer: '1',
  explanation: '// discards the fractional part of the quotient.'
},
{
  title: 'List Method to Append',
  type: 'MCQ',
  topic: 'Lists',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Which method adds a single element to the end of a list?',
  options: ['extend()', 'insert()', 'append()', 'add()'],
  answer: '2',
  explanation: 'append() adds exactly one element to the end.'
},
{
  title: 'Default Return Value',
  type: 'MCQ',
  topic: 'Functions',
  difficulty: 'MEDIUM',
  marks: 1,
  prompt: 'What does a Python function return when it has no return statement?',
  options: ['0', 'None', 'False', 'Raises an error'],
  answer: '1',
  explanation: 'Functions implicitly return None.'
},
{
  title: 'Dictionary Key Rule',
  type: 'MCQ',
  topic: 'Dictionaries',
  difficulty: 'MEDIUM',
  marks: 1,
  prompt: 'Which of these can NOT be used as a dictionary key?',
  options: ['str', 'tuple', 'list', 'int'],
  answer: '2',
  explanation: 'Dictionary keys must be hashable; lists are mutable and unhashable.'
},
{
  title: 'Exception Base Class',
  type: 'MCQ',
  topic: 'Exceptions',
  difficulty: 'MEDIUM',
  marks: 1,
  prompt: 'Which clause always executes in a try statement, regardless of exceptions?',
  options: ['except', 'else', 'finally', 'raise'],
  answer: '2',
  explanation: 'finally runs whether or not an exception was raised.'
},
{
  title: 'String Formatting',
  type: 'MCQ',
  topic: 'Strings',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Which syntax creates an f-string in Python 3.6+?',
  options: ["format'text'", "f'text {x}'", "'text'.f(x)", "$'text'"],
  answer: '1',
  explanation: 'f-strings are written with an f prefix before the quote.'
},
{
  title: 'Range Behaviour',
  type: 'MCQ',
  topic: 'Loops',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'How many values does range(2, 10, 3) produce?',
  options: ['2', '3', '4', '8'],
  answer: '1',
  explanation: 'It produces 2, 5, 8 — three values.'
},
{
  title: 'Module Import Keyword',
  type: 'MCQ',
  topic: 'Modules',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Which statement imports only the sqrt function from the math module?',
  options: ['import math.sqrt', 'from math import sqrt', 'include math.sqrt', 'import sqrt from math'],
  answer: '1',
  explanation: 'from <module> import <name> imports a single name.'
},

// ---------------- TRUE / FALSE ----------------
{
  title: 'Python Is Case Sensitive',
  type: 'TRUE_FALSE',
  topic: 'Basics',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Python identifiers are case sensitive.',
  answer: 'true',
  explanation: 'name and Name are distinct identifiers.'
},
{
  title: 'Indentation Is Optional',
  type: 'TRUE_FALSE',
  topic: 'Syntax',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Indentation in Python is optional and only improves readability.',
  answer: 'false',
  explanation: 'Indentation defines block structure and is mandatory.'
},

// ---------------- FILL IN THE BLANK ----------------
{
  title: 'Read User Input',
  type: 'FILL_BLANK',
  topic: 'Basics',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Complete the code to take input from the user and store it in a variable named name.',
  code: 'name = __________("Enter your name: ")',
  answer: 'input',
  alternatives: ['input()'],
  explanation: 'input() returns the typed text as a string.'
},
{
  title: 'Length of a List',
  type: 'FILL_BLANK',
  topic: 'Lists',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Complete the statement to print the number of items in the list.',
  code: 'items = [4, 8, 15, 16]\nprint(__________(items))',
  answer: 'len',
  alternatives: ['len()']
},
{
  title: 'Convert String to Integer',
  type: 'FILL_BLANK',
  topic: 'Data Types',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Complete the code so that age holds an integer value.',
  code: 'age = __________(input("Age: "))',
  answer: 'int',
  alternatives: ['int()']
},
{
  title: 'Loop Keyword',
  type: 'FILL_BLANK',
  topic: 'Loops',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Complete the loop header that iterates over every element of data.',
  code: '__________ item in data:\n    print(item)',
  answer: 'for'
},
{
  title: 'Define a Function',
  type: 'FILL_BLANK',
  topic: 'Functions',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'Complete the keyword used to define a function.',
  code: '__________ greet(name):\n    print("Hello", name)',
  answer: 'def'
},

// ---------------- OUTPUT PREDICTION ----------------
{
  title: 'List Slicing Output',
  type: 'OUTPUT',
  topic: 'Lists',
  difficulty: 'MEDIUM',
  marks: 1,
  prompt: 'What is the exact output of the following program?',
  code: 'nums = [1, 2, 3, 4, 5]\nprint(nums[1:4])',
  answer: '[2, 3, 4]'
},
{
  title: 'String Repetition Output',
  type: 'OUTPUT',
  topic: 'Strings',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'What is the exact output of the following program?',
  code: 'print("ab" * 3)',
  answer: 'ababab'
},
{
  title: 'Integer Division Output',
  type: 'OUTPUT',
  topic: 'Operators',
  difficulty: 'EASY',
  marks: 1,
  prompt: 'What is the exact output of the following program?',
  code: 'print(7 // 2, 7 % 2)',
  answer: '3 1'
},
{
  title: 'Set Deduplication Output',
  type: 'OUTPUT',
  topic: 'Sets',
  difficulty: 'MEDIUM',
  marks: 1,
  prompt: 'What is the exact output of the following program?',
  code: 'print(len(set([1, 1, 2, 3, 3, 3])))',
  answer: '3'
},
{
  title: 'Loop Accumulator Output',
  type: 'OUTPUT',
  topic: 'Loops',
  difficulty: 'MEDIUM',
  marks: 1,
  prompt: 'What is the exact output of the following program?',
  code: 'total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)',
  answer: '10'
},

// ---------------- CODE COMPLETION ----------------
{
  title: 'Complete the Sum Function',
  type: 'CODE_COMPLETION',
  topic: 'Functions',
  difficulty: 'MEDIUM',
  marks: 2,
  prompt: 'Complete the missing line so the function returns the sum of the list.',
  code: 'def total(values):\n    result = 0\n    for v in values:\n        # MISSING LINE\n    return result',
  answer: 'result += v',
  alternatives: ['result = result + v']
},
{
  title: 'Complete the Even Filter',
  type: 'CODE_COMPLETION',
  topic: 'Loops',
  difficulty: 'MEDIUM',
  marks: 2,
  prompt: 'Complete the condition so only even numbers are appended.',
  code: 'evens = []\nfor n in nums:\n    if # MISSING CONDITION\n        evens.append(n)',
  answer: 'n % 2 == 0',
  alternatives: ['n%2==0']
},
{
  title: 'Complete the Dictionary Lookup',
  type: 'CODE_COMPLETION',
  topic: 'Dictionaries',
  difficulty: 'MEDIUM',
  marks: 2,
  prompt: 'Complete the expression that safely reads a key with a default of 0.',
  code: 'counts = {"a": 3}\nvalue = counts.__________("b", 0)',
  answer: 'get'
},
{
  title: 'Complete the Reverse String',
  type: 'CODE_COMPLETION',
  topic: 'Strings',
  difficulty: 'MEDIUM',
  marks: 2,
  prompt: 'Complete the slice that reverses the string.',
  code: 'text = "python"\nreversed_text = text[__________]',
  answer: '::-1'
},
{
  title: 'Complete the File Read',
  type: 'CODE_COMPLETION',
  topic: 'Files',
  difficulty: 'HARD',
  marks: 2,
  prompt: 'Complete the context manager keyword used to open a file safely.',
  code: '__________ open("data.txt") as f:\n    content = f.read()',
  answer: 'with'
},

// ---------------- DEBUGGING ----------------
{
  title: 'Debug the Loop',
  type: 'DEBUGGING',
  topic: 'Loops',
  difficulty: 'MEDIUM',
  marks: 2,
  prompt:
  'The loop below raises an IndexError. Write the corrected loop header line.',
  code: 'items = [10, 20, 30]\nfor i in range(len(items) + 1):\n    print(items[i])',
  answer: 'for i in range(len(items)):',
  alternatives: ['for i in range(len(items)) :'],
  explanation: 'range(len(items) + 1) walks one index past the end of the list.'
},
{
  title: 'Debug the Function Return',
  type: 'DEBUGGING',
  topic: 'Functions',
  difficulty: 'MEDIUM',
  marks: 2,
  prompt: 'This function prints instead of returning. Write the corrected last line.',
  code: 'def square(n):\n    print(n * n)',
  answer: 'return n * n'
},
{
  title: 'Debug the Comparison',
  type: 'DEBUGGING',
  topic: 'Operators',
  difficulty: 'EASY',
  marks: 2,
  prompt: 'The condition uses assignment instead of comparison. Write the corrected line.',
  code: 'x = 5\nif x = 5:\n    print("five")',
  answer: 'if x == 5:'
},
{
  title: 'Debug the String Concatenation',
  type: 'DEBUGGING',
  topic: 'Strings',
  difficulty: 'MEDIUM',
  marks: 2,
  prompt: 'This raises a TypeError. Write the corrected print statement.',
  code: 'age = 19\nprint("Age: " + age)',
  answer: 'print("Age: " + str(age))',
  alternatives: ['print(f"Age: {age}")']
},
{
  title: 'Debug the Dictionary Access',
  type: 'DEBUGGING',
  topic: 'Dictionaries',
  difficulty: 'HARD',
  marks: 2,
  prompt: 'This raises a KeyError when the key is missing. Write a safe replacement line.',
  code: 'scores = {"a": 1}\nvalue = scores["b"]',
  answer: 'value = scores.get("b", 0)',
  alternatives: ['value = scores.get("b")']
},

// ---------------- CODING ----------------
{
  title: 'Prime Number Program',
  type: 'CODING',
  topic: 'Logic',
  difficulty: 'HARD',
  marks: 5,
  prompt:
  'Write a Python program that reads an integer N and prints "PRIME" if N is a prime number, otherwise prints "NOT PRIME".',
  inputFormat: 'A single integer N (2 ≤ N ≤ 10^6).',
  outputFormat: 'A single line: PRIME or NOT PRIME.',
  constraints: '2 ≤ N ≤ 10^6. Time limit 1 second.',
  sampleInput: '17',
  sampleOutput: 'PRIME',
  answer: 'MANUAL_EVALUATION',
  testCases: [
  { input: '17', output: 'PRIME' },
  { input: '18', output: 'NOT PRIME' }]

},
{
  title: 'Sum of Digits',
  type: 'CODING',
  topic: 'Logic',
  difficulty: 'MEDIUM',
  marks: 5,
  prompt: 'Read an integer N and print the sum of its digits.',
  inputFormat: 'A single integer N.',
  outputFormat: 'A single integer — the digit sum.',
  constraints: '0 ≤ N ≤ 10^9.',
  sampleInput: '1234',
  sampleOutput: '10',
  answer: 'MANUAL_EVALUATION',
  testCases: [
  { input: '1234', output: '10' },
  { input: '900', output: '9' }]

}];