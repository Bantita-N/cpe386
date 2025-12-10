const puzzles = [
  {
    id: 1,
    gameType: 'multipleChoice',
    question: 'สัญลักษณ์ใดแสดงถึงจุดเริ่มต้นของ Flowchart?',
    choices: [
      { image: './img/Quiz/S__7602196.jpg' },
      { image: './img/Quiz/S__7602195.jpg' },
      { image: './img/Quiz/S__7602197.jpg' },
      { image: './img/Quiz/S__7602194.jpg' }
    ],
    answerIndex: 3,
    points: 10
  },
  {
    id: 2,
    gameType: 'fishing',
    question: 'สัญลักษณ์ใดมีชื่อเรียกว่า Manual Input',
    choices: [
      { text: 'A', image: './img/Quiz/S__7602192.jpg' },
      { text: 'B', image: './img/Quiz/S__7602193.jpg' },
      { text: 'C', image: './img/Quiz/S__7602191.jpg' },
      { text: 'D', image: './img/Quiz/S__7602197.jpg' }
    ],
    answerIndex: 0,
    points: 10
  },
  {
    id: 3,
    gameType: 'matchup',
    question: 'สัญลักษณ์ใดจับคู่กับชื่อเรียกได้ถูกต้อง ?',
    choices: [
      { image: './img/Quiz/S__7602187.jpg' },
      { image: './img/Quiz/S__7602189.jpg' },
      { image: './img/Quiz/S__7602188.jpg' },
      { image: './img/Quiz/S__7602190.jpg' }
    ],
    answerIndex: 3,
    points: 10
  },
  {
    id: 4,
    gameType: 'hangman',
    question: 'สัญลักษณ์ต่อไปนี้มีชื่อเรียกว่าอะไร ?',
    image: './img/Quiz/ทิศทางการทำงานของผังงาน.png',
    choices: ['Arror', 'Flow Line', 'Liner', 'Direction'],
    answerIndex: 1,
    points: 10
  },
  {
    id: 5,
    gameType: 'multipleChoice',
    question: 'สัญลักษณ์ต่อไปนี้มีความหมายว่าอย่างไร ?',
    image: './img/Quiz/S__7602193.jpg',
    choices: ['A.การประมวลผล', 'B.การตัดสินใจ', 'C.การแสดงผลข้อมูล', 'D.การนำเข้าข้อมูลด้วยมือ'],
    answerIndex: 2,
    points: 10
  }
]
