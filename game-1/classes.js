class Sprite {
  constructor({
    position,
    velocity,
    image,
    frames = { max: 1, hold: 10 },
    sprites,
    animate = false,
    rotation = 0,
    scale = 1
  }) {
    this.position = position
    this.frames = { ...frames, val: 0, elapsed: 0 }
    // Accept either an Image instance or an object with a `src` property
    if (image instanceof Image) {
      this.image = image
    } else {
      this.image = new Image()
      this.image.src = image && image.src ? image.src : image
    }

    // If scale is the special value 'fit', compute a scale to match the map width
    const initialScale = scale
    this.image.onload = () => {
      // honor an explicit override (page can set `window.BACKGROUND_SCALE` to a number)
      let computedScale = (window && typeof window.BACKGROUND_SCALE === 'number') ? window.BACKGROUND_SCALE : initialScale
      if (initialScale === 'fit') {
        try {
          const mapCols = (window && window.MAP_COLS) ? Number(window.MAP_COLS) : null
          const desiredWidth = mapCols && Boundary && Boundary.width ? mapCols * Boundary.width : null
          // try to get the canvas height to avoid vertical gaps
          const canvasEl = document.querySelector && document.querySelector('canvas')
          const canvasH = canvasEl ? canvasEl.height : null

          const scaleW = desiredWidth ? desiredWidth / this.image.width : 1
          const scaleH = canvasH ? canvasH / this.image.height : 1

          // Use the larger scale so the image covers both desired map width and canvas height
          computedScale = Math.max(scaleW, scaleH)
          // If page requested 'no-downscale' mode, prevent computedScale from going below 1
          if (window && window.BACKGROUND_SCALE_MODE === 'no-downscale') computedScale = Math.max(computedScale, 1)
          if (!isFinite(computedScale) || computedScale <= 0) computedScale = 1
          // Prefer integer scaling when upscaling to keep pixels sharp; for downscale, snap to 0.1 steps
          if (computedScale >= 1) computedScale = Math.max(1, Math.round(computedScale))
          else computedScale = Math.max(0.1, Math.round(computedScale * 10) / 10)
        } catch (e) {
          computedScale = 1
        }
      }

      this.scale = computedScale
      this.width = (this.image.width / this.frames.max) * this.scale
      this.height = this.image.height * this.scale
    }

    this.animate = animate
    this.sprites = sprites
    this.opacity = 1

    this.rotation = rotation
    this.scale = scale
  }

  draw() {
    c.save()
    // disable image smoothing to keep pixel-art crisp when scaled
    const prevSmoothing = c.imageSmoothingEnabled
    const prevQuality = c.imageSmoothingQuality
    try { c.imageSmoothingEnabled = false; c.imageSmoothingQuality = 'low' } catch (e) {}
    c.translate(
      this.position.x + this.width / 2,
      this.position.y + this.height / 2
    )
    c.rotate(this.rotation)
    c.translate(
      -this.position.x - this.width / 2,
      -this.position.y - this.height / 2
    )
    c.globalAlpha = this.opacity

    // source crop in original image pixels
    const srcWidth = this.image.width / this.frames.max
    const srcX = this.frames.val * srcWidth
    const srcY = 0
    const srcH = this.image.height

    // destination in canvas pixels (round to integers to avoid fractional scaling blur)
    const destX = Math.round(this.position.x)
    const destY = Math.round(this.position.y)
    const destW = Math.round(srcWidth * this.scale)
    const destH = Math.round(srcH * this.scale)

    c.drawImage(
      this.image,
      srcX,
      srcY,
      srcWidth,
      srcH,
      destX,
      destY,
      destW,
      destH
    )

    // restore smoothing and canvas state
    try { c.imageSmoothingEnabled = prevSmoothing; c.imageSmoothingQuality = prevQuality } catch (e) {}
    c.restore()

    if (!this.animate) return

    if (this.frames.max > 1) {
      this.frames.elapsed++
    }

    if (this.frames.elapsed % this.frames.hold === 0) {
      if (this.frames.val < this.frames.max - 1) this.frames.val++
      else this.frames.val = 0
    }
  }
}

class Monster extends Sprite {
  constructor({
    position,
    velocity,
    image,
    frames = { max: 1, hold: 10 },
    sprites,
    animate = false,
    rotation = 0,
    isEnemy = false,
    name,
    attacks
  }) {
    super({
      position,
      velocity,
      image,
      frames,
      sprites,
      animate,
      rotation
    })
    this.health = 100
    this.isEnemy = isEnemy
    this.name = name
    this.attacks = attacks
  }

  faint() {
    document.querySelector('#dialogueBox').innerHTML = this.name + ' fainted!'
    gsap.to(this.position, {
      y: this.position.y + 20
    })
    gsap.to(this, {
      opacity: 0
    })
    audio.battle.stop()
    audio.victory.play()
  }

  attack({ attack, recipient, renderedSprites }) {
    document.querySelector('#dialogueBox').style.display = 'block'
    document.querySelector('#dialogueBox').innerHTML =
      this.name + ' used ' + attack.name

    let healthBar = '#enemyHealthBar'
    if (this.isEnemy) healthBar = '#playerHealthBar'

    let rotation = 1
    if (this.isEnemy) rotation = -2.2

    recipient.health -= attack.damage

    switch (attack.name) {
      case 'Fireball':
        audio.initFireball.play()
        const fireballImage = new Image()
        fireballImage.src = './img/fireball.png'
        const fireball = new Sprite({
          position: {
            x: this.position.x,
            y: this.position.y
          },
          image: fireballImage,
          frames: {
            max: 4,
            hold: 10
          },
          animate: true,
          rotation
        })
        renderedSprites.splice(1, 0, fireball)

        gsap.to(fireball.position, {
          x: recipient.position.x,
          y: recipient.position.y,
          onComplete: () => {
            // Enemy actually gets hit
            audio.fireballHit.play()
            gsap.to(healthBar, {
              width: recipient.health + '%'
            })

            gsap.to(recipient.position, {
              x: recipient.position.x + 10,
              yoyo: true,
              repeat: 5,
              duration: 0.08
            })

            gsap.to(recipient, {
              opacity: 0,
              repeat: 5,
              yoyo: true,
              duration: 0.08
            })
            renderedSprites.splice(1, 1)
          }
        })

        break
      case 'Tackle':
        const tl = gsap.timeline()

        let movementDistance = 20
        if (this.isEnemy) movementDistance = -20

        tl.to(this.position, {
          x: this.position.x - movementDistance
        })
          .to(this.position, {
            x: this.position.x + movementDistance * 2,
            duration: 0.1,
            onComplete: () => {
              // Enemy actually gets hit
              audio.tackleHit.play()
              gsap.to(healthBar, {
                width: recipient.health + '%'
              })

              gsap.to(recipient.position, {
                x: recipient.position.x + 10,
                yoyo: true,
                repeat: 5,
                duration: 0.08
              })

              gsap.to(recipient, {
                opacity: 0,
                repeat: 5,
                yoyo: true,
                duration: 0.08
              })
            }
          })
          .to(this.position, {
            x: this.position.x
          })
        break
    }
  }
}

class Boundary {
  static width = 48
  static height = 48
  constructor({ position }) {
    this.position = position
    this.width = 48
    this.height = 48
  }

  draw() {
    c.fillStyle = 'rgba(255, 0, 0, 0)'
    c.fillRect(this.position.x, this.position.y, this.width, this.height)
  }
}

class Character extends Sprite {
  constructor({
    position,
    velocity,
    image,
    frames = { max: 1, hold: 10 },
    sprites,
    animate = false,
    rotation = 0,
    scale = 1,
    dialogue = ['']
  }) {
    super({
      position,
      velocity,
      image,
      frames,
      sprites,
      animate,
      rotation,
      scale
    })

    this.dialogue = dialogue
    this.dialogueIndex = 0
  }
}
