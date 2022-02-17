import * as PIXI from './modules/vendor/pixi.mjs'
import SwappableSprite from "./modules/swappableSprite.js";
import TrackedKeyboardKey from "./modules/trackedKeyboardKey.js";
import SpriteWithHandles, { handles } from './modules/spriteWithHandles.js'

const CANVAS_WIDTH = 128
const CANVAS_HEIGHT = 128
const CANVAS_BACKGROUND_COLOR = 0x222222

document.addEventListener("DOMContentLoaded", (event) => {
    let hatImagePaths = [
        'images/stamps/hat01.png',
        'images/stamps/hat02.png',
        'images/stamps/hat09.png',
        'images/stamps/hat08.png',
        'images/stamps/hat10.png',
        'images/stamps/hat06.png',
        'images/stamps/hat07.png',
        'images/stamps/hat05.png',
        'images/stamps/hat03.png',
        'images/stamps/hat04.png'
    ]
    
    const hatScrollerElem = document.getElementById('hat-scroller');
    hatImagePaths.forEach((hatImagePath, i) => {
        const elem = document.createElement('div')
        elem.innerHTML = `
            <input id="hat-option-${i}" type="radio" name="hat" value="${i}" ${i === 0 ? 'checked' : ''}/>
            <label for="hat-option-${i}" class="hat-radio-option" style="background-image: url('${hatImagePath}')">
        `;
        hatScrollerElem.append(elem)
        elem.getElementsByTagName('label')[0].addEventListener('click', () => {
            hatScrollerElem.scrollTo({
                left: hatScrollerElem.scrollLeft + elem.getBoundingClientRect().left - hatScrollerElem.getBoundingClientRect().left, 
                behavior: 'smooth'
            })
        })
    })
    
    // init pixi
    let app = new PIXI.Application({ 
        width: CANVAS_WIDTH, 
        height: CANVAS_HEIGHT, 
        backgroundColor: CANVAS_BACKGROUND_COLOR, 
        preserveDrawingBuffer: true // so we can extract the buffer for download
    });
    document.getElementById('pixi-app-container').appendChild(app.view);
    // enable mobile scroll on canvas
    app.renderer.view.style.touchAction = 'auto';
    app.renderer.plugins.interaction.autoPreventDefault = false;

    let hatTextures = hatImagePaths.map((hatImagePath) => PIXI.Texture.from(hatImagePath))

    let uploadedImageSprite = new SwappableSprite()
    uploadedImageSprite.interactive = true
    uploadedImageSprite.on('pointerdown', (event) => {
        hats.forEach((hat) => {
            hat.unfocus()
        })
    });
    app.stage.addChild(uploadedImageSprite)

    let debugGraphics = new PIXI.Graphics();
    app.stage.addChild(debugGraphics)

    let hats = []

    const resizeApp = (() => {
        let handleResizeTimeoutHandle;
        const _resizeApp = () => {
            const width = uploadedImageSprite?.originalWidth
            const height = uploadedImageSprite?.originalHeight
            if(width + height > 0){
                let ratio = height / width;
                const newWidth = Math.min(width, window.innerWidth)
                const newHeight = newWidth * ratio
                app.renderer.resize(newWidth, newHeight);

                let scale = Math.min(newWidth / width, 1)
                app.stage.scale.set(scale)
                const handleScale = 1/scale
                handles.forEach((handle) => handle.scale.set(handleScale))
            }
        }
        return (debounceMs = 100) => {
            if(handleResizeTimeoutHandle){
                clearTimeout(handleResizeTimeoutHandle)
            }
            if(debounceMs){
                handleResizeTimeoutHandle = setTimeout(_resizeApp, debounceMs)
            }else{
                _resizeApp()
            }
        }
    })()

    window.addEventListener('resize', () => {
        resizeApp()
    });

    // on meme chosen
    document.getElementById('upload-btn').addEventListener('change', (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const fileDataURL = event.target.result;
            const loader = PIXI.Loader.shared;
            loader.add('upload', fileDataURL)
            loader.load((loader, resources) => {
                uploadedImageSprite.setSprite(PIXI.Sprite.from(fileDataURL))
                resizeApp(0)

                document.getElementById('start-layout').style.display = 'none';
                document.getElementById('hat-bar').style.display = null;
                document.getElementById('pixi-app-container').style.display = null;
                document.getElementById('bottom-btn-bar').style.display = null;
            })
        }
        reader.readAsDataURL(file)
    });

    // only one hat focused at a time
    const onHatFocused = (hat) => {
        hats.forEach((x) => x === hat || x.unfocus())
    }

    const addHat = (texture) => {
        let inverseStageScale = 1/app.stage.scale.x;
        let hat = new SpriteWithHandles(texture, inverseStageScale, debugGraphics);
        hat.onFocus = onHatFocused;
        hat.x = app.renderer.width * 0.5 * inverseStageScale;
        hat.y = app.renderer.height * 0.5 * inverseStageScale;
        hats.push(hat)
        app.stage.addChild(hat)
        hat.focus()
        return hat;
    }

    // add new hat
    document.getElementById('add-hat-btn').addEventListener('click', (event) => {
        let selectedHatElem = document.querySelector('input[name=hat]:checked')
        if(selectedHatElem === null){
            console.log('no hat selected but tried to add hat')
            return;
        }
        let hatTextureIndex = parseInt(selectedHatElem.value)
        let hatTexture = hatTextures[hatTextureIndex]
        addHat(hatTexture)
    })

    // export img
    document.getElementById('export-btn').addEventListener('click', (event) => {
        let focusedHat = hats.find((x) => x.isFocused)
        focusedHat?.unfocus()
        app.render()

        var tmpDownloadLink = document.createElement('a');
        tmpDownloadLink.setAttribute('href', app.renderer.plugins.extract.base64());
        tmpDownloadLink.setAttribute('download', 'huntmeme');
        tmpDownloadLink.style.display = 'none';
        document.body.appendChild(tmpDownloadLink);
        tmpDownloadLink.click();
        document.body.removeChild(tmpDownloadLink);

        focusedHat?.focus()
    })

    // copy img to clipboard
    document.getElementById('copy-btn').addEventListener('click', (event) => {
        let focusedHat = hats.find((x) => x.isFocused);
        focusedHat?.unfocus();
        app.render();

        app.renderer.plugins.extract.canvas().toBlob((blob) => {
            const data = [new ClipboardItem({[blob.type]: blob})];
            navigator.clipboard.write(data).then(() => {
                const addClassTemporarily = (elem, className, removeAfterMs, reset = false) => {
                    const removeClass = (elem, className) => {
                        let classes = elem.className.split(' ');
                        const existingClassOccurenceIndex = classes.findIndex((x) => x === className);
                        if(existingClassOccurenceIndex !== -1){
                            classes.splice(existingClassOccurenceIndex, 1);
                            elem.className = classes.join(' ')
                        }
                    }
                    if(reset){
                        removeClass(elem, className)
                    }
                    if(!elem.className.includes(className)){
                        elem.className += ` ${className}`;
                    }
                    setTimeout(() => {
                        removeClass(elem, className)
                    }, removeAfterMs)
                }
                addClassTemporarily(event.target, 'btn-post-success', 1000, true)  
            })
        })

        focusedHat?.focus()
    })

    //// hotkeys
    const hotkeyDefinitions = [];

    hotkeyDefinitions.push({
        label: 'F',
        description: 'flip horizontally' 
    });
    const flipHatHorizontalKey = new TrackedKeyboardKey('f')
    flipHatHorizontalKey.onPress = () => {
        let hat = hats.find((x) => x.isFocused)
        if(hat){
            hat.flipHorizontal()
        }
    }

    hotkeyDefinitions.push({
        label: 'R',
        description: 'reset rotation and scale' 
    });
    const resetHatKey = new TrackedKeyboardKey('r')
    resetHatKey.onPress = () => {
        let hat = hats.find((x) => x.isFocused)
        if(hat){
            hat.resetAdjustments()
        }
    }

    hotkeyDefinitions.push({
        label: 'D',
        description: 'duplicate' 
    });
    const duplicateHatKey = new TrackedKeyboardKey('d')
    duplicateHatKey.onPress = () => {
        let hat = hats.find((x) => x.isFocused)
        if(hat){
            let texture = hat.texture;
            let clone = addHat(texture)
            clone.rotation = hat.rotation;
            clone.scale.x = hat.scale.x;
            clone.scale.y = hat.scale.y;
        }
    }

    hotkeyDefinitions.push({
        label: 'SHIFT',
        description: 'while scaling, unlock aspect ratio' 
    });
    const scaleMaintainAspectRatioModifierKey = new TrackedKeyboardKey('Shift')
    scaleMaintainAspectRatioModifierKey.onPress = () => {
        hats.forEach((x) => x.maintainAspectRatio = true)
        let hat = hats.find((x) => x.isFocused)
        if(hat){
            hat.maintainAspectRatio = false;
        }
    }
    scaleMaintainAspectRatioModifierKey.onRelease = () => {
        hats.forEach((x) => x.maintainAspectRatio = false)
        let hat = hats.find((x) => x.isFocused)
        if(hat){
            hat.maintainAspectRatio = true;
        }
    }

    hotkeyDefinitions.push({
        label: 'DEL',
        description: 'remove selected hat' 
    });
    const deleteHatKey = new TrackedKeyboardKey('Delete')
    deleteHatKey.onPress = () => {
        let hatIndex = hats.findIndex((x) => x.isFocused)
        if(hatIndex >= 0){
            let hat = hats[hatIndex]
            app.stage.removeChild(hat)
            hats.splice(hatIndex, 1)
            hat.destroy()
            hat = null
        }
    }

    hotkeyDefinitions.push({
        label: 'ESC',
        description: 'unfocus all'
    })
    const unfocusKey = new TrackedKeyboardKey('Escape');
    unfocusKey.onPress = () => hats.forEach((x) => x.unfocus())

    // generate shortcuts markup
    const shortcutsContainerElem = document.querySelector('.shortcuts-tooltip ul')
    hotkeyDefinitions.forEach((hotkeyDefinition) => {
        const elem = document.createElement('li')
        elem.innerHTML = `<strong>${hotkeyDefinition.label}</strong>${hotkeyDefinition.description}`;
        shortcutsContainerElem.append(elem)
    })

    // pixi update
    let elapsedTime = 0
    app.ticker.add((deltaTime) => {
        elapsedTime += deltaTime
        debugGraphics.clear()
        hats.forEach((hat) => hat.update(deltaTime))
    })
});