const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

canvas.width = 1500
canvas.height = 720

const collisionsMap = []
for (let i = 0; i < collisions.length; i += 70) {
  collisionsMap.push(collisions.slice(i, 70 + i))
}

// expose map column count for sprite scaling helpers
window.MAP_COLS = collisionsMap[0] ? collisionsMap[0].length : 70

const battleZonesMap = []
for (let i = 0; i < battleZonesData.length; i += 70) {
  battleZonesMap.push(battleZonesData.slice(i, 70 + i))
}

const charactersMap = []
for (let i = 0; i < charactersMapData.length; i += 70) {
  charactersMap.push(charactersMapData.slice(i, 70 + i))
}
console.log(charactersMap)

const boundaries = []
const offset = {
  x: -735,
  y: -650
}

collisionsMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    if (symbol === 1025)
      boundaries.push(
        new Boundary({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          }
        })
      )
  })
})

const battleZones = []

battleZonesMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    if (symbol === 1025)
      battleZones.push(
        new Boundary({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          }
        })
      )
  })
})

// ---- House zones (simple prototype) ----
// Assumption: houses are located at a few tile positions on the map. You can adjust the (i,j)
// pairs below to match the actual house locations on your map image.
// Try to load saved house positions/mapping from localStorage so puzzles stay at the same houses
// default house tile positions (used when there is no saved mapping)
const defaultHouseTilePositions = [
  { i: 14, j: 45.5 },
  { i: 18, j: 25.5 },
  { i: 27, j: 39.5 },
  { i: 13, j: 20 },
  { i: 26.5, j: 30 },
]

// allow a stage to override house positions by setting `window.HOUSE_TILE_POSITIONS` in the page
let houseTilePositions = null
try {
  if (window && Array.isArray(window.HOUSE_TILE_POSITIONS) && window.HOUSE_TILE_POSITIONS.length > 0) {
    houseTilePositions = JSON.parse(JSON.stringify(window.HOUSE_TILE_POSITIONS))
  } else {
    const saved = localStorage.getItem('houseTilePositions')
    if (saved) houseTilePositions = JSON.parse(saved)
  }
} catch (e) {}

// If nothing saved, use defaults. If saved but has fewer entries than puzzles,
// fill the missing entries from defaults so there are always at least as many
// house zones as there are puzzles (prevents "missing" boxes).
if (!houseTilePositions || !Array.isArray(houseTilePositions) || houseTilePositions.length === 0) {
  houseTilePositions = defaultHouseTilePositions.slice(0, puzzles.length)
} else if (houseTilePositions.length < puzzles.length) {
  // append missing default positions (avoid overwriting existing ones)
  for (let k = houseTilePositions.length; k < puzzles.length; k++) {
    const fallback = defaultHouseTilePositions[k] || { i: 12 + k * 2, j: 12 + k * 3 }
    houseTilePositions.push(fallback)
  }
  try {
    localStorage.setItem('houseTilePositions', JSON.stringify(houseTilePositions))
  } catch (e) {}
}

const houseZones = []
houseTilePositions.forEach(({ i, j }, idx) => {
  // each zone has a draw() so we can render a small translucent square on the map
  const zone = {
    position: {
      x: j * Boundary.width + offset.x,
      y: i * Boundary.height + offset.y
    },
    width: Boundary.width,
    height: Boundary.height,
    draw() {
      // if solved, show greenish; otherwise blueish translucent square
      try {
        const solved = houseSolved && houseSolved[idx]
        c.fillStyle = solved ? 'rgba(0,200,0,0.25)' : 'rgba(0,0,200,0.25)'
      } catch (e) {
        c.fillStyle = 'rgba(0,0,200,0.25)'
      }
      c.fillRect(this.position.x, this.position.y, this.width, this.height)
    }
  }

  houseZones.push(zone)
})

// track which houses have been solved and player's score
// (initialized below after zones are created)

// (movables/renderables will be updated after they are declared)

let puzzleOpen = false
let puzzleWiggleInterval = null

// initialize solved flags and score now that houseZones exist
let houseSolved = new Array(houseZones.length).fill(false)
let playerScore = 0

// Timer (seconds)
// set initial time from stage config if provided (e.g. stage2 can set window.TIME_LIMIT = 90)
let timeLeft = Number(window.TIME_LIMIT) || 120 // seconds
let timerIntervalId = null
let gameOver = false

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function startTimer() {
  // clear existing
  if (timerIntervalId) clearInterval(timerIntervalId)
  document.querySelector('#timerDisplay').innerText = formatTime(timeLeft)
  timerIntervalId = setInterval(() => {
    if (gameOver) return
    timeLeft--
    document.querySelector('#timerDisplay').innerText = formatTime(timeLeft)
    if (timeLeft <= 0) {
      clearInterval(timerIntervalId)
      onTimeUp()
    }
  }, 1000)
}

function onTimeUp() {
  gameOver = true
  // show overlay
  document.querySelector('#timeUpOverlay').style.display = 'flex'
  try {
    audio.Map.stop()
  } catch (e) {}
  // cancel animation (if running)
  try {
    if (window.currentAnimationId) window.cancelAnimationFrame(window.currentAnimationId)
  } catch (e) {}
}

document.querySelector('#timeUpRestart').addEventListener('click', () => {
  // reset state
  document.querySelector('#timeUpOverlay').style.display = 'none'
  gameOver = false
  timeLeft = 120
  playerScore = 0
  document.querySelector('#scoreDisplay').innerText = playerScore
  document.querySelector('#playerScore').innerText = playerScore
  houseSolved = new Array(houseZones.length).fill(false)
  rebuildHouseZones()
  try {
    audio.Map.play()
  } catch (e) {}
  startTimer()
  animate()
})

// Grid overlay + interactive placement
let showGrid = false

function drawGrid() {
  const tileW = Boundary.width
  const tileH = Boundary.height

  const startJ = Math.floor((-background.position.x) / tileW) - 1
  const endJ = startJ + Math.ceil(canvas.width / tileW) + 3

  const startI = Math.floor((-background.position.y) / tileH) - 1
  const endI = startI + Math.ceil(canvas.height / tileH) + 3

  c.save()
  c.strokeStyle = 'rgba(255,255,255,0.12)'
  c.fillStyle = 'rgba(255,255,255,0.6)'
  c.font = '10px Arial'

  for (let j = startJ; j <= endJ; j++) {
    const x = background.position.x + j * tileW
    c.beginPath()
    c.moveTo(x, 0)
    c.lineTo(x, canvas.height)
    c.stroke()
    c.fillText(j, x + 2, 10)
  }

  for (let i = startI; i <= endI; i++) {
    const y = background.position.y + i * tileH
    c.beginPath()
    c.moveTo(0, y)
    c.lineTo(canvas.width, y)
    c.stroke()
    c.fillText(i, 2, y + 10)
  }

  c.restore()
}

function openPuzzle(houseIndex) {
  if (puzzleOpen) return
  if (houseSolved[houseIndex]) return
  puzzleOpen = true
  
  // pick a puzzle based on the persistent mapping (puzzleIndex)
  const mapping = houseTilePositions[houseIndex]
  const puzzleIndex = mapping && typeof mapping.puzzleIndex !== 'undefined' ? mapping.puzzleIndex : houseIndex % puzzles.length
  const puzzle = puzzles[puzzleIndex % puzzles.length]
  
  // บันทึก state ปัจจุบัน
  window.currentPuzzleIndex = puzzleIndex
  window.currentHouseIndex = houseIndex
  window.currentPuzzle = puzzle
  
  // เลือกเกมตามประเภท
  const gameType = puzzle.gameType || 'fishing'
  
  switch(gameType) {
    case 'fishing':
      openFishingGame(puzzle, houseIndex)
      break
    case 'wordSearch':
      openWordSearchGame(puzzle, houseIndex)
      break
    case 'matchup':
      openMatchupGame(puzzle, houseIndex)
      break
    case 'hangman':
      openHangmanGame(puzzle, houseIndex)
      break
    case 'multipleChoice':
    default:
      openMultipleChoiceGame(puzzle, houseIndex)
      break
  }
}

// ===== เกม 1: Fishing (ตกปลา) =====
function openFishingGame(puzzle, houseIndex) {
  document.querySelector('#puzzleQuestion').innerText = puzzle.question || ''
  const puzzleImageEl = document.querySelector('#puzzleImage')
  if (puzzle && puzzle.image) {
    puzzleImageEl.src = puzzle.image
    puzzleImageEl.style.display = 'block'
  } else {
    puzzleImageEl.src = ''
    puzzleImageEl.style.display = 'none'
  }

  const choicesContainer = document.querySelector('#puzzleChoices')
  choicesContainer.innerHTML = ''

  puzzle.choices.forEach((choiceEntry, idx) => {
    const btn = document.createElement('button')
    btn.style.padding = '10px'
    btn.style.display = 'flex'
    btn.style.alignItems = 'center'
    btn.style.gap = '10px'
    btn.style.background = 'linear-gradient(90deg, #b7d8ff, #8ac4ff)'
    btn.style.border = '3px solid #004e92'
    btn.style.borderRadius = '10px'
    btn.style.boxShadow = '0 6px 0 #002d5c'
    btn.style.cursor = 'pointer'
    btn.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease'
    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-2px)'
      btn.style.boxShadow = '0 8px 0 #002d5c'
    }
    btn.onmouseleave = () => {
      btn.style.transform = 'translateY(0)'
      btn.style.boxShadow = '0 6px 0 #002d5c'
    }

    if (typeof choiceEntry === 'string') {
      btn.innerText = choiceEntry
    } else if (choiceEntry && typeof choiceEntry === 'object') {
      btn.style.display = 'flex'
      btn.style.flexDirection = 'column'
      btn.style.alignItems = 'center'
      btn.style.justifyContent = 'center'
      
      if (choiceEntry.image) {
        const img = document.createElement('img')
        img.src = choiceEntry.image
        img.style.maxWidth = '100px'
        img.style.maxHeight = '60px'
        img.style.display = 'block'
        img.style.objectFit = 'contain'
        img.style.marginBottom = '6px'
        btn.appendChild(img)
      }
      if (choiceEntry.text) {
        const span = document.createElement('span')
        span.innerText = choiceEntry.text
        span.style.fontSize = '12px'
        span.style.fontWeight = 'bold'
        btn.appendChild(span)
      }
    }

    btn.onclick = () => {
      const correct = idx === puzzle.answerIndex
      if (correct) {
        playerScore += puzzle.points
        houseSolved[houseIndex] = true
        document.querySelector('#playerScore').innerText = playerScore
        document.querySelector('#scoreDisplay').innerText = playerScore
        showScoreScreen(puzzle.points)
      } else {
        try {
          timeLeft = Math.max(0, timeLeft - 8)
          document.querySelector('#timerDisplay').innerText = formatTime(timeLeft)
          showWrongScreen()
          if (audio && audio.tackleHit) audio.tackleHit.play()
        } catch (e) {}
        return
      }
      closePuzzle()
    }
    choicesContainer.appendChild(btn)
  })

  document.querySelector('#puzzleModal').style.display = 'block'
  if (puzzleWiggleInterval) clearInterval(puzzleWiggleInterval)
  puzzleWiggleInterval = setInterval(() => {
    const buttons = choicesContainer.querySelectorAll('button')
    buttons.forEach((b, i) => {
      const dx = (Math.random() * 6 - 3).toFixed(1)
      const dy = (Math.random() * 4 - 2).toFixed(1)
      b.style.transform = `translate(${dx}px, ${dy}px)`
      setTimeout(() => {
        b.style.transform = 'translate(0, 0)'
      }, 220)
    })
  }, 900)
}

// ===== เกม 2: Word Search (ค้นหาคำ) =====
function openWordSearchGame(puzzle, houseIndex) {
  document.querySelector('#wsQuestion').innerText = puzzle.question || ''
  const wsGrid = document.querySelector('#wsGrid')
  wsGrid.innerHTML = ''
  
  // สร้างตัวเลือก 5 ปุ่ม
  (puzzle.choices || []).slice(0, 5).forEach((choiceEntry, idx) => {
    const btn = document.createElement('button')
    btn.style.padding = '12px 16px'
    btn.style.background = '#ffb74d'
    btn.style.border = '3px solid #ff6b6b'
    btn.style.borderRadius = '8px'
    btn.style.cursor = 'pointer'
    btn.style.boxShadow = '0 4px 0 #ff6b6b'
    btn.style.fontWeight = 'bold'
    btn.style.transition = 'all 0.15s ease'
    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-2px)'
      btn.style.boxShadow = '0 6px 0 #ff6b6b'
    }
    btn.onmouseleave = () => {
      btn.style.transform = 'translateY(0)'
      btn.style.boxShadow = '0 4px 0 #ff6b6b'
    }
    
    btn.innerText = typeof choiceEntry === 'string' ? choiceEntry : (choiceEntry.text || '')
    btn.onclick = () => {
      const correct = idx === puzzle.answerIndex
      if (correct) {
        playerScore += puzzle.points
        houseSolved[houseIndex] = true
        document.querySelector('#playerScore').innerText = playerScore
        document.querySelector('#scoreDisplay').innerText = playerScore
        document.querySelector('#wsScore').innerText = playerScore
        showScoreScreen(puzzle.points)
        setTimeout(() => closePuzzle(), 1500)
      } else {
        try {
          timeLeft = Math.max(0, timeLeft - 8)
          document.querySelector('#timerDisplay').innerText = formatTime(timeLeft)
          showWrongScreen()
          if (audio && audio.tackleHit) audio.tackleHit.play()
        } catch (e) {}
      }
    }
    wsGrid.appendChild(btn)
  })
  
  document.querySelector('#wordSearchModal').style.display = 'block'
}

// ===== เกม 3: Match-up (จับคู่) =====
function openMatchupGame(puzzle, houseIndex) {
  document.querySelector('#muQuestion').innerText = puzzle.question || ''
  const muGrid = document.querySelector('#muGrid')
  muGrid.innerHTML = ''
  
  const choices = puzzle.choices || []
  const paired = choices.slice(0, 4)
  
  paired.forEach((choiceEntry, idx) => {
    const btn = document.createElement('button')
    btn.style.padding = '14px'
    btn.style.background = '#ce93d8'
    btn.style.border = '3px solid #9c27b0'
    btn.style.borderRadius = '8px'
    btn.style.cursor = 'pointer'
    btn.style.boxShadow = '0 4px 0 #9c27b0'
    btn.style.fontWeight = 'bold'
    btn.style.transition = 'all 0.15s ease'
    btn.style.minHeight = '80px'
    btn.onmouseenter = () => {
      btn.style.transform = 'scale(1.05)'
      btn.style.boxShadow = '0 6px 0 #9c27b0'
    }
    btn.onmouseleave = () => {
      btn.style.transform = 'scale(1)'
      btn.style.boxShadow = '0 4px 0 #9c27b0'
    }
    
    if (choiceEntry.image) {
      const img = document.createElement('img')
      img.src = choiceEntry.image
      img.style.maxWidth = '100%'
      img.style.maxHeight = '60px'
      img.style.display = 'block'
      btn.appendChild(img)
    }
    if (choiceEntry.text) {
      const span = document.createElement('span')
      span.innerText = choiceEntry.text
      span.style.display = 'block'
      btn.appendChild(span)
    }
    
    btn.onclick = () => {
      const correct = idx === puzzle.answerIndex
      if (correct) {
        playerScore += puzzle.points
        houseSolved[houseIndex] = true
        document.querySelector('#playerScore').innerText = playerScore
        document.querySelector('#scoreDisplay').innerText = playerScore
        document.querySelector('#muScore').innerText = playerScore
        showScoreScreen(puzzle.points)
        setTimeout(() => closePuzzle(), 1500)
      } else {
        try {
          timeLeft = Math.max(0, timeLeft - 8)
          document.querySelector('#timerDisplay').innerText = formatTime(timeLeft)
          showWrongScreen()
          if (audio && audio.tackleHit) audio.tackleHit.play()
        } catch (e) {}
      }
    }
    muGrid.appendChild(btn)
  })
  
  document.querySelector('#matchupModal').style.display = 'block'
}

// ===== เกม 4: Hangman (แฮงแมน) =====
function openHangmanGame(puzzle, houseIndex) {
  document.querySelector('#hgQuestion').innerText = puzzle.question || ''
  
  // แสดงรูปโจทย์ถ้ามี
  const hgQuestionImage = document.querySelector('#hgQuestionImage')
  if (puzzle.image) {
    hgQuestionImage.innerHTML = `<img src="${puzzle.image}" style="max-width:100%; max-height:200px; border:3px solid #e91e63; border-radius:8px;" />`
  } else {
    hgQuestionImage.innerHTML = ''
  }
  
  const hgChoices = document.querySelector('#hgChoices')
  hgChoices.innerHTML = ''
  
  const choices = puzzle.choices || []
  choices.slice(0, 4).forEach((choiceEntry, idx) => {
    const btn = document.createElement('button')
    btn.style.padding = '8px 12px'
    btn.style.background = '#f48fb1'
    btn.style.border = '3px solid #e91e63'
    btn.style.borderRadius = '6px'
    btn.style.cursor = 'pointer'
    btn.style.boxShadow = '0 3px 0 #e91e63'
    btn.style.transition = 'all 0.15s ease'
    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-2px)'
      btn.style.boxShadow = '0 5px 0 #e91e63'
    }
    btn.onmouseleave = () => {
      btn.style.transform = 'translateY(0)'
      btn.style.boxShadow = '0 3px 0 #e91e63'
    }
    
    btn.innerText = typeof choiceEntry === 'string' ? choiceEntry : choiceEntry.text
    btn.onclick = () => {
      const correct = idx === puzzle.answerIndex
      if (correct) {
        playerScore += puzzle.points
        houseSolved[houseIndex] = true
        document.querySelector('#playerScore').innerText = playerScore
        document.querySelector('#scoreDisplay').innerText = playerScore
        document.querySelector('#hgScore').innerText = playerScore
        document.querySelector('#hgDisplay').innerText = '✓✓✓✓'
        showScoreScreen(puzzle.points)
        setTimeout(() => closePuzzle(), 1500)
      } else {
        try {
          timeLeft = Math.max(0, timeLeft - 8)
          document.querySelector('#timerDisplay').innerText = formatTime(timeLeft)
          showWrongScreen()
          if (audio && audio.tackleHit) audio.tackleHit.play()
        } catch (e) {}
      }
    }
    hgChoices.appendChild(btn)
  })
  
  document.querySelector('#hangmanModal').style.display = 'block'
}

// ===== เกม 5: Multiple Choice (ปกติ) =====
function openMultipleChoiceGame(puzzle, houseIndex) {
  document.querySelector('#mcQuestion').innerText = puzzle.question || ''
  
  // แสดงรูปโจทย์ถ้ามี
  const mcQuestionImage = document.querySelector('#mcQuestionImage')
  if (puzzle.image) {
    mcQuestionImage.innerHTML = `<img src="${puzzle.image}" style="max-width:100%; max-height:200px; border:3px solid #2196f3; border-radius:8px;" />`
  } else {
    mcQuestionImage.innerHTML = ''
  }
  
  const mcChoices = document.querySelector('#mcChoices')
  mcChoices.innerHTML = ''
  
  puzzle.choices.forEach((choiceEntry, idx) => {
    const btn = document.createElement('button')
    btn.style.padding = '10px'
    btn.style.background = '#64b5f6'
    btn.style.border = '3px solid #2196f3'
    btn.style.borderRadius = '8px'
    btn.style.cursor = 'pointer'
    btn.style.boxShadow = '0 4px 0 #1565c0'
    btn.style.color = '#000'
    btn.style.transition = 'all 0.15s ease'
    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-2px)'
      btn.style.boxShadow = '0 6px 0 #1565c0'
    }
    btn.onmouseleave = () => {
      btn.style.transform = 'translateY(0)'
      btn.style.boxShadow = '0 4px 0 #1565c0'
    }
    
    if (typeof choiceEntry === 'string') {
      btn.innerText = choiceEntry
    } else if (choiceEntry && typeof choiceEntry === 'object') {
      // ถ้ามีรูป ให้แสดงรูป
      if (choiceEntry.image) {
        btn.innerHTML = `<img src="${choiceEntry.image}" style="max-width:120px; max-height:120px; display:block; border-radius:4px;" />`
        btn.style.padding = '5px'
      } else if (choiceEntry.text) {
        btn.innerText = choiceEntry.text
      }
    }
    
    btn.onclick = () => {
      const correct = idx === puzzle.answerIndex
      if (correct) {
        playerScore += puzzle.points
        houseSolved[houseIndex] = true
        document.querySelector('#playerScore').innerText = playerScore
        document.querySelector('#scoreDisplay').innerText = playerScore
        document.querySelector('#mcScore').innerText = playerScore
        showScoreScreen(puzzle.points)
        setTimeout(() => closePuzzle(), 1500)
      } else {
        try {
          timeLeft = Math.max(0, timeLeft - 8)
          document.querySelector('#timerDisplay').innerText = formatTime(timeLeft)
          showWrongScreen()
          if (audio && audio.tackleHit) audio.tackleHit.play()
        } catch (e) {}
      }
    }
    mcChoices.appendChild(btn)
  })
  
  document.querySelector('#multipleChoiceModal').style.display = 'block'
}

function closePuzzle() {
  puzzleOpen = false
  if (puzzleWiggleInterval) {
    clearInterval(puzzleWiggleInterval)
    puzzleWiggleInterval = null
  }
  // ปิด modal ทั้งหมด
  document.querySelector('#puzzleModal').style.display = 'none'
  document.querySelector('#wordSearchModal').style.display = 'none'
  document.querySelector('#matchupModal').style.display = 'none'
  document.querySelector('#hangmanModal').style.display = 'none'
  document.querySelector('#multipleChoiceModal').style.display = 'none'
}

// Fun score screen with GSAP and confetti dots
function showScoreScreen(points) {
  try {
    const popup = document.querySelector('#scorePopup')
    const gain = document.querySelector('#scoreGain')
    const totalSmall = document.querySelector('#scoreTotalInPopup')
    const badge = document.querySelector('#badgeText')
    const confetti = document.querySelector('#confettiContainer')

    gain.innerText = `+${points}`
    totalSmall.innerText = playerScore

    // pick badge text
    if (points >= 10) badge.innerText = 'Amazing!'
    else badge.innerText = 'Nice!'

    // show popup
    popup.style.display = 'block'
    popup.style.opacity = 0
    popup.style.transform = 'translate(-50%,-50%) scale(0.6)'

    // clear confetti
    confetti.innerHTML = ''
    for (let i = 0; i < 18; i++) {
      const dot = document.createElement('div')
      dot.style.position = 'absolute'
      dot.style.left = Math.random() * 420 + 'px'
      dot.style.top = Math.random() * 20 + 'px'
      dot.style.width = '8px'
      dot.style.height = '8px'
      dot.style.borderRadius = '50%'
      const colors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#9b59b6']
      dot.style.background = colors[Math.floor(Math.random() * colors.length)]
      confetti.appendChild(dot)
      gsap.to(dot, {
        y: 150 + Math.random() * 120,
        x: -60 + Math.random() * 120,
        opacity: 0,
        duration: 1.2 + Math.random() * 0.6,
        ease: 'power2.out'
      })
    }

    gsap.to(popup, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.7)' })

    // floating +points text
    const float = document.createElement('div')
    float.innerText = `+${points}`
    float.style.position = 'absolute'
    float.style.left = '50%'
    float.style.top = '36%'
    float.style.transform = 'translateX(-50%)'
    float.style.fontSize = '26px'
    float.style.color = '#0652DD'
    float.style.fontWeight = '700'
    float.style.zIndex = '40'
    document.body.appendChild(float)
    gsap.to(float, { y: '-=80', opacity: 0, duration: 1.2, onComplete: () => float.remove() })

    // play victory sound if available
    try {
      if (audio && audio.victory) audio.victory.play()
    } catch (e) {}

    // hide popup after a while
    setTimeout(() => {
      gsap.to(popup, { opacity: 0, scale: 0.6, duration: 0.35, onComplete() { popup.style.display = 'none' } })
    }, 1400)
    // Do NOT auto-warp here. Require the player to go to the pier and confirm warp.
    try {
      if (playerScore >= totalPossibleScore && totalPossibleScore > 0 && timeLeft > 0) {
        // Player has reached the target score — they must stand at the pier to warp.
        // Optionally: show a brief hint in console or update a HUD element if present.
        console.log('คะแนนเต็ม! ไปที่ท่าเรือเพื่อวาร์ป (ยืนยันที่นั่น)')
      }
    } catch (e) {}
  } catch (e) {
    console.warn('score popup failed', e)
  }
}

// Wrong answer screen
function showWrongScreen() {
  try {
    const popup = document.querySelector('#wrongPopup')
    
    // show popup
    popup.style.display = 'block'
    popup.style.opacity = '0'
    popup.style.transform = 'translate(-50%,-50%) scale(0.6)'

    gsap.to(popup, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.7)' })

    // hide popup after a while
    setTimeout(() => {
      gsap.to(popup, { 
        opacity: 0, 
        scale: 0.6, 
        duration: 0.35, 
        onComplete() { 
          popup.style.display = 'none'
          popup.style.transform = 'translate(-50%,-50%) scale(0.6)'
        } 
      })
    }, 1400)
  } catch (e) {
    console.warn('wrong popup failed', e)
  }
}

// ผูกปุ่มปิดสำหรับทุกเกม
document.querySelector('#puzzleClose').addEventListener('click', () => {
  closePuzzle()
})

document.querySelector('#wsClose').addEventListener('click', () => {
  closePuzzle()
})

document.querySelector('#muClose').addEventListener('click', () => {
  closePuzzle()
})

document.querySelector('#hgClose').addEventListener('click', () => {
  closePuzzle()
})

document.querySelector('#mcClose').addEventListener('click', () => {
  closePuzzle()
})

// warp modal controls
document.querySelector('#warpCancel').addEventListener('click', () => {
  document.querySelector('#warpModal').style.display = 'none'
})
document.querySelector('#warpConfirm').addEventListener('click', () => {
  // only warp if all solved and time remains
  // require full score instead of relying only on houseSolved flags
  const allSolved = playerScore >= totalPossibleScore
  if (!allSolved || timeLeft <= 0) {
    // small feedback
    document.querySelector('#warpMessage').innerText = 'ยังไม่สามารถวาร์ปได้'
    return
  }
  warpToNextStage()
})

function warpToNextStage() {
  // placeholder: stop map and show overlay, play sound
  try {
    if (window.currentAnimationId) window.cancelAnimationFrame(window.currentAnimationId)
    audio.Map.stop()
    if (audio && audio.victory) audio.victory.play()
  } catch (e) {}

  document.querySelector('#warpModal').style.display = 'none'
  // show a temporary overlay message
  const overlay = document.createElement('div')
  overlay.style.position = 'absolute'
  overlay.style.inset = '0'
  overlay.style.background = 'rgba(0,0,0,0.85)'
  overlay.style.zIndex = 60
  overlay.style.color = 'white'
  overlay.style.display = 'flex'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.innerHTML = '<div style="text-align:center"><h1>วาร์ปไปด่านใหม่!</h1></div>'
  document.body.appendChild(overlay)

  // after showing, reset or stop
  setTimeout(() => {
    // navigate to the next stage page instead of reloading (new stage placeholder)
    try {
      overlay.remove()
    } catch (e) {}
    // Use a relative path so the browser opens the new stage HTML
    window.location.href = './stage2.html'
  }, 1800)
}

// small helper to check overlap area with simple rectangle-shaped zones
function overlappingArea(rect1, rect2) {
  return (
    Math.max(0, Math.min(rect1.position.x + rect1.width, rect2.position.x + rect2.width) - Math.max(rect1.position.x, rect2.position.x)) *
    Math.max(0, Math.min(rect1.position.y + rect1.height, rect2.position.y + rect2.height) - Math.max(rect1.position.y, rect2.position.y))
  )
}

const characters = []
const villagerImg = new Image()
villagerImg.src = './img/villager/Idle.png'

const oldManImg = new Image()
oldManImg.src = './img/oldMan/Idle.png'

charactersMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    // 1026 === villager
    if (symbol === 1026) {
      characters.push(
        new Character({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          },
          image: villagerImg,
          frames: {
            max: 4,
            hold: 60
          },
          scale: 3,
          animate: true,
          dialogue: ['...', 'Hey mister, have you seen my Doggochu?']
        })
      )
    }
    // 1031 === oldMan
    else if (symbol === 1031) {
      characters.push(
        new Character({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          },
          image: oldManImg,
          frames: {
            max: 4,
            hold: 60
          },
          scale: 3,
          dialogue: ['My bones hurt.']
        })
      )
    }

    if (symbol !== 0) {
      boundaries.push(
        new Boundary({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          }
        })
      )
    }
  })
})

const image = new Image()
image.src = (window && window.BACKGROUND_IMAGE) ? window.BACKGROUND_IMAGE : './img/Pellet Town.png'
image.onerror = (err) => console.error('Failed to load background image:', image.src, err)

const foregroundImage = new Image()
foregroundImage.src = './img/foregroundObjects.png'

const playerDownImage = new Image()
playerDownImage.src = './img/playerDown.png'

const playerUpImage = new Image()
playerUpImage.src = './img/playerUp.png'

const playerLeftImage = new Image()
playerLeftImage.src = './img/playerLeft.png'

const playerRightImage = new Image()
playerRightImage.src = './img/playerRight.png'

const player = new Sprite({
  position: {
    x: canvas.width / 2 - 192 / 4 / 2,
    y: canvas.height / 2 - 68 / 2
  },
  image: playerDownImage,
  frames: {
    max: 4,
    hold: 10
  },
  sprites: {
    up: playerUpImage,
    left: playerLeftImage,
    right: playerRightImage,
    down: playerDownImage
  }
})

const background = new Sprite({
  position: {
    x: offset.x,
    y: offset.y
  },
  image: image,
  // 'fit' scale will auto-scale the background to MATCH the tile grid width
  scale: 'fit'
})

// --- Background debug overlay ---
;(function createBackgroundDebug() {
  const dbg = document.createElement('div')
  dbg.id = 'bgDebug'
  dbg.style.position = 'fixed'
  dbg.style.right = '12px'
  dbg.style.bottom = '12px'
  dbg.style.zIndex = 9999
  dbg.style.background = 'rgba(0,0,0,0.7)'
  dbg.style.color = 'white'
  dbg.style.fontSize = '12px'
  dbg.style.padding = '8px'
  dbg.style.borderRadius = '6px'
  dbg.style.maxWidth = '260px'
  dbg.style.fontFamily = 'monospace'
  dbg.style.display = 'none'
  dbg.innerHTML = '<strong>BG debug</strong><br><div id="bgDebugContent">loading...</div><div style="margin-top:6px"><small>Toggle: H</small></div>'
  document.body.appendChild(dbg)

  function update() {
    try {
      const img = background.image
      const src = img && (img.src || img.currentSrc) ? (img.src || img.currentSrc) : 'none'
      const naturalW = img && img.naturalWidth ? img.naturalWidth : 'n/a'
      const naturalH = img && img.naturalHeight ? img.naturalHeight : 'n/a'
      const scale = background.scale || 'n/a'
      const renderW = background.width || 'n/a'
      const renderH = background.height || 'n/a'
      const mapCols = window.MAP_COLS || 'n/a'
      document.getElementById('bgDebugContent').innerHTML =
        'src: ' + src + '<br>' +
        'natural: ' + naturalW + 'x' + naturalH + '<br>' +
        'scale: ' + scale + '<br>' +
        'render: ' + renderW + 'x' + renderH + '<br>' +
        'MAP_COLS: ' + mapCols
    } catch (e) {}
  }

  // update on background image load and periodically while visible
  try { image.addEventListener('load', update) } catch (e) {}
  setInterval(() => { if (dbg.style.display !== 'none') update() }, 800)

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
      dbg.style.display = dbg.style.display === 'none' ? 'block' : 'none'
    }
  })
})()

const foreground = new Sprite({
  position: {
    x: offset.x,
    y: offset.y
  },
  image: foregroundImage
})

const keys = {
  w: {
    pressed: false
  },
  a: {
    pressed: false
  },
  s: {
    pressed: false
  },
  d: {
    pressed: false
  }
}

const movables = [
  background,
  ...boundaries,
  foreground,
  ...battleZones,
  ...characters
]
const renderables = [
  background,
  ...boundaries,
  ...battleZones,
  ...characters,
  player,
  foreground
]

// ---- Pier / warp zone ----
// Added an extra pier at { i:16, j:54 } per user request
const pierTilePositions = [
  { i: 33, j: 8 },
  { i: 16, j: 54 }
]
const pierZones = []

function rebuildPierZones() {
  // remove previous pier zones
  for (let i = movables.length - 1; i >= 0; i--) if (movables[i] && movables[i].isPier) movables.splice(i, 1)
  for (let i = renderables.length - 1; i >= 0; i--) if (renderables[i] && renderables[i].isPier) renderables.splice(i, 1)
  pierZones.length = 0
  pierTilePositions.forEach(({ i, j }, idx) => {
    const zone = {
      isPier: true,
      position: { x: j * Boundary.width + offset.x, y: i * Boundary.height + offset.y },
      width: Boundary.width,
      height: Boundary.height,
      draw() {
        c.fillStyle = 'rgba(255,165,0,0.25)'
        c.fillRect(this.position.x, this.position.y, this.width, this.height)
      }
    }
    pierZones.push(zone)
  })
  movables.push(...pierZones)
  const pIndex = renderables.findIndex((r) => r === player)
  if (pIndex >= 0) renderables.splice(pIndex, 0, ...pierZones)
  else renderables.push(...pierZones)
}

rebuildPierZones()

// rebuild house zones helper: clears any existing house zones in movables/renderables
function rebuildHouseZones() {
  // remove previous house zones from movables
  for (let i = movables.length - 1; i >= 0; i--) {
    if (movables[i] && movables[i].isHouseZone) movables.splice(i, 1)
  }

  // remove previous house zones from renderables
  for (let i = renderables.length - 1; i >= 0; i--) {
    if (renderables[i] && renderables[i].isHouseZone) renderables.splice(i, 1)
  }

  // clear the houseZones array
  houseZones.length = 0

  houseTilePositions.forEach(({ i, j }, idx) => {
    // make the interactive zone smaller (half tile) and center it inside the tile
    const zoneSizeW = Boundary.width / 2
    const zoneSizeH = Boundary.height / 2
    // ensure this house has a persistent puzzleIndex mapping
    if (typeof houseTilePositions[idx].puzzleIndex === 'undefined') {
      // assign next unused puzzle index, or use idx % puzzles.length
      const used = houseTilePositions.map((h) => h.puzzleIndex).filter((v) => typeof v !== 'undefined')
      let assigned = null
      for (let p = 0; p < puzzles.length; p++) {
        if (!used.includes(p)) {
          assigned = p
          break
        }
      }
      if (assigned === null) assigned = idx % puzzles.length
      houseTilePositions[idx].puzzleIndex = assigned
    }

    const zone = {
      isHouseZone: true,
      position: {
        x: j * Boundary.width + offset.x + zoneSizeW / 2,
        y: i * Boundary.height + offset.y + zoneSizeH / 2
      },
      width: zoneSizeW,
      height: zoneSizeH,
      draw() {
        const solved = houseSolved && houseSolved[idx]
        c.fillStyle = solved ? 'rgba(0,200,0,0.25)' : 'rgba(0,0,200,0.25)'
        c.fillRect(this.position.x, this.position.y, this.width, this.height)
      },
      puzzleIndex: houseTilePositions[idx].puzzleIndex
    }

    houseZones.push(zone)
  })

  // add to movables so they move with the map
  movables.push(...houseZones)

  // insert into renderables just before the player
  const playerIndex = renderables.findIndex((r) => r === player)
  if (playerIndex >= 0) renderables.splice(playerIndex, 0, ...houseZones)
  else renderables.push(...houseZones)

  // reinitialize solved flags (preserve previous solved state where possible)
  const prev = houseSolved
  houseSolved = new Array(houseZones.length).fill(false)
  for (let k = 0; k < Math.min(prev.length || 0, houseSolved.length); k++) houseSolved[k] = prev[k]

  // persist mapping so puzzles stay bound to houses across reloads
  try {
    localStorage.setItem('houseTilePositions', JSON.stringify(houseTilePositions))
  } catch (e) {}
  // recompute total possible score after rebuild
  try {
    computeTotalPossible()
  } catch (e) {}
}

// initial build
rebuildHouseZones()

// compute total possible score based on assigned puzzles for current houses
let totalPossibleScore = 0
function computeTotalPossible() {
  totalPossibleScore = 0
  for (let k = 0; k < houseTilePositions.length; k++) {
    const pIdx = houseTilePositions[k].puzzleIndex
    const p = puzzles[pIdx % puzzles.length]
    if (p && p.points) totalPossibleScore += p.points
  }
  // update start screen display if present
  const targetEl = document.querySelector('#targetScoreDisplay')
  if (targetEl) targetEl.innerText = totalPossibleScore
}
computeTotalPossible()

const battle = {
  initiated: false
}

function animate() {
  const animationId = window.requestAnimationFrame(animate)
  // keep id globally so other functions can cancel
  window.currentAnimationId = animationId
  // Draw grid under renderables when requested (helps pick tile positions)
  if (showGrid) drawGrid()

  renderables.forEach((renderable) => {
    renderable.draw()
  })

  if (puzzleOpen) return

  let moving = true
  player.animate = false

  if (battle.initiated) return

  // activate a battle
  if (keys.w.pressed || keys.a.pressed || keys.s.pressed || keys.d.pressed) {
    for (let i = 0; i < battleZones.length; i++) {
      const battleZone = battleZones[i]
      const overlappingArea =
        (Math.min(
          player.position.x + player.width,
          battleZone.position.x + battleZone.width
        ) -
          Math.max(player.position.x, battleZone.position.x)) *
        (Math.min(
          player.position.y + player.height,
          battleZone.position.y + battleZone.height
        ) -
          Math.max(player.position.y, battleZone.position.y))
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: battleZone
        }) &&
        overlappingArea > (player.width * player.height) / 2 &&
        Math.random() < 0.01
      ) {
        // deactivate current animation loop
        window.cancelAnimationFrame(animationId)

        audio.Map.stop()
        audio.initBattle.play()
        audio.battle.play()

        battle.initiated = true
        gsap.to('#overlappingDiv', {
          opacity: 1,
          repeat: 3,
          yoyo: true,
          duration: 0.4,
          onComplete() {
            gsap.to('#overlappingDiv', {
              opacity: 1,
              duration: 0.4,
              onComplete() {
                // activate a new animation loop
                initBattle()
                animateBattle()
                gsap.to('#overlappingDiv', {
                  opacity: 0,
                  duration: 0.4
                })
              }
            })
          }
        })
        break
      }
    }
    // check for house entry (no randomness)
    for (let h = 0; h < houseZones.length; h++) {
      const house = houseZones[h]
        // trigger only when player's center is inside the house zone (more precise)
        const playerCenterX = player.position.x + player.width / 2
        const playerCenterY = player.position.y + player.height / 2
        if (
          playerCenterX >= house.position.x &&
          playerCenterX <= house.position.x + house.width &&
          playerCenterY >= house.position.y &&
          playerCenterY <= house.position.y + house.height
        ) {
          openPuzzle(h)
          break
        }
    }
      // check for pier (warp)
      for (let p = 0; p < pierZones.length; p++) {
        const pier = pierZones[p]
        const playerCenterX = player.position.x + player.width / 2
        const playerCenterY = player.position.y + player.height / 2
        if (
          playerCenterX >= pier.position.x &&
          playerCenterX <= pier.position.x + pier.width &&
          playerCenterY >= pier.position.y &&
          playerCenterY <= pier.position.y + pier.height
        ) {
          // allow warp only if all houses solved and time remains
              // require full score to enable warp (player must be standing here)
              const allSolved = playerScore >= totalPossibleScore
              if (allSolved && timeLeft > 0) {
            // show warp modal
            document.querySelector('#warpMessage').innerText = 'พร้อมไปด่านใหม่! วาร์ปเลย?'
            document.querySelector('#warpModal').style.display = 'block'
          } else if (!allSolved) {
            document.querySelector('#warpMessage').innerText = 'ยังมีบ้านที่ยังไม่แก้ปริศนา'
            document.querySelector('#warpModal').style.display = 'block'
          } else if (timeLeft <= 0) {
            document.querySelector('#warpMessage').innerText = 'หมดเวลา ไม่สามารถวาร์ป'
            document.querySelector('#warpModal').style.display = 'block'
          }
          break
        }
      }
  }

  if (keys.w.pressed && lastKey === 'w') {
    player.animate = true
    player.image = player.sprites.up

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: 0, y: 3 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x,
              y: boundary.position.y + 3
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving)
      movables.forEach((movable) => {
        movable.position.y += 3
      })
  } else if (keys.a.pressed && lastKey === 'a') {
    player.animate = true
    player.image = player.sprites.left

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: 3, y: 0 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x + 3,
              y: boundary.position.y
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving)
      movables.forEach((movable) => {
        movable.position.x += 3
      })
  } else if (keys.s.pressed && lastKey === 's') {
    player.animate = true
    player.image = player.sprites.down

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: 0, y: -3 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x,
              y: boundary.position.y - 3
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving)
      movables.forEach((movable) => {
        movable.position.y -= 3
      })
  } else if (keys.d.pressed && lastKey === 'd') {
    player.animate = true
    player.image = player.sprites.right

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: -3, y: 0 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x - 3,
              y: boundary.position.y
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving)
      movables.forEach((movable) => {
        movable.position.x -= 3
      })
  }
}
// Do not auto-start animation; show start screen and wait for user action
document.querySelector('#startButton').addEventListener('click', () => {
  document.querySelector('#startScreen').style.display = 'none'
  // ensure timer visible
  try { document.querySelector('#timerBox').style.display = 'block' } catch (e) {}
  gameOver = false
  timeLeft = Number(window.TIME_LIMIT) || 120
  startTimer()
  try { audio.Map.play() } catch (e) {}
  animate()
})

document.querySelector('#startPractice').addEventListener('click', () => {
  document.querySelector('#startScreen').style.display = 'none'
  // hide timer in practice mode
  try { document.querySelector('#timerBox').style.display = 'none' } catch (e) {}
  gameOver = false
  // do not start timer
  try { audio.Map.play() } catch (e) {}
  animate()
})

let lastKey = ''
window.addEventListener('keydown', (e) => {
  // toggle grid overlay for debugging/placement
  if (e.key === 'g') {
    showGrid = !showGrid
  }
  if (player.isInteracting) {
    switch (e.key) {
      case ' ':
        player.interactionAsset.dialogueIndex++

        const { dialogueIndex, dialogue } = player.interactionAsset
        if (dialogueIndex <= dialogue.length - 1) {
          document.querySelector('#characterDialogueBox').innerHTML =
            player.interactionAsset.dialogue[dialogueIndex]
          return
        }

        // finish conversation
        player.isInteracting = false
        player.interactionAsset.dialogueIndex = 0
        document.querySelector('#characterDialogueBox').style.display = 'none'

        break
    }
    return
  }

  switch (e.key) {
    case ' ':
      if (!player.interactionAsset) return

      // beginning the conversation
      const firstMessage = player.interactionAsset.dialogue[0]
      document.querySelector('#characterDialogueBox').innerHTML = firstMessage
      document.querySelector('#characterDialogueBox').style.display = 'flex'
      player.isInteracting = true
      break
    case 'w':
      keys.w.pressed = true
      lastKey = 'w'
      break
    case 'a':
      keys.a.pressed = true
      lastKey = 'a'
      break

    case 's':
      keys.s.pressed = true
      lastKey = 's'
      break

    case 'd':
      keys.d.pressed = true
      lastKey = 'd'
      break
  }
})

window.addEventListener('keyup', (e) => {
  switch (e.key) {
    case 'w':
      keys.w.pressed = false
      break
    case 'a':
      keys.a.pressed = false
      break
    case 's':
      keys.s.pressed = false
      break
    case 'd':
      keys.d.pressed = false
      break
  }
})

let clicked = false
addEventListener('click', () => {
  if (!clicked) {
    audio.Map.play()
    clicked = true
  }
})

// click on canvas while grid is shown to add a house tile at that location
document.querySelector('canvas').addEventListener('click', (ev) => {
  if (!showGrid) return
  const rect = canvas.getBoundingClientRect()
  const clickX = ev.clientX - rect.left
  const clickY = ev.clientY - rect.top

  // map screen coords to world coords using background position
  const worldX = clickX - background.position.x
  const worldY = clickY - background.position.y

  const tileJ = Math.floor(worldX / Boundary.width)
  const tileI = Math.floor(worldY / Boundary.height)

  // add to tile positions and rebuild zones
  // assign a puzzleIndex to keep mapping deterministic
  const used = houseTilePositions.map((h) => h.puzzleIndex).filter((v) => typeof v !== 'undefined')
  let assigned = null
  for (let p = 0; p < puzzles.length; p++) {
    if (!used.includes(p)) {
      assigned = p
      break
    }
  }
  if (assigned === null) assigned = houseTilePositions.length % puzzles.length
  houseTilePositions.push({ i: tileI, j: tileJ, puzzleIndex: assigned })
  rebuildHouseZones()
  try { localStorage.setItem('houseTilePositions', JSON.stringify(houseTilePositions)) } catch (e) {}
})
