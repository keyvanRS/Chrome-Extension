/* global chrome, chromeExtStorage, NodeFilter, Node, Event, openPopup, deletePopup */
const {
    connect,
    onMessage,
} = chrome.runtime;

var MinRankForAutoHighlight = 2000;

chromeExtStorage.get('minRankForAutoHighlight', (value) => {
    const {
        minRankForAutoHighlight,
    } = value;
    MinRankForAutoHighlight = minRankForAutoHighlight;
});

const twoLetterWordRegex = /[a-zA-Z]{2,}/g;
const newLineSymbolRegex = /\n/ig;
const excludedTags = ['SCRIPT', 'BUTTON'];
const excludedTagsForIconPopup = ['SCRIPT'];

const {
    getWordsObjMessage,
    updateWordsObjMessage,
    userLoggedInMessage,
    userLoggedOutMessage,
    activeTabMessage,
} = {
    getWordsObjMessage: 'getWordsObj',
    updateWordsObjMessage: 'updateWordsObj',
    userLoggedInMessage: 'userLoggedIn',
    userLoggedOutMessage: 'userLoggedOut',
    activeTabMessage: 'tabActivated',
};


let wordsObj;
let KnownWords;
var pageNodeArr = [];

const getAllTextElements = () => {
    let pageNode;
    pageNodeArr = [];
    const treeWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (excludedTags.includes(node.tagName)) {
                return NodeFilter.FILTER_REJECT;
            }
            const nodeIsTextNode = node.nodeType === Node.TEXT_NODE;
            if (!nodeIsTextNode) {
                return NodeFilter.FILTER_SKIP;
            }

            if (node.parentElement.className !== undefined && typeof node.parentElement.className === "string") {
                if (node.parentElement.className.includes("word-up")) {
                    return NodeFilter.FILTER_SKIP;
                }
            }

            const textInNode = node.textContent || node || '';
            try {

                const wordNodes = textInNode.replace(newLineSymbolRegex, '').trim().match(twoLetterWordRegex);

                if (!wordNodes) {
                    return NodeFilter.FILTER_SKIP;
                }

                return NodeFilter.FILTER_ACCEPT;
            } catch (e) {
                return NodeFilter.FILTER_SKIP;
            }
        },
    },
    );

    while (pageNode = treeWalker.nextNode()) {
        pageNodeArr.push(pageNode);
    }

};


function findClickedWord(parentElt, x, y) {
    const textNodes = [].filter.call(parentElt.childNodes, (item) => item.nodeType === Node.TEXT_NODE && item.textContent.replace(newLineSymbolRegex, '').trim());
    if (textNodes.length) {
        for (const textNode of textNodes) {
            const range = document.createRange();
            const words = textNode.textContent.split(/[^a-zA-Z]/g);
            let start = 0;
            let end = 0;
            for (let i = 0, wordsLength = words.length; i < wordsLength; i++) {
                const word = words[i];
                end = start + word.length;
                range.setStart(textNode, start);
                range.setEnd(textNode, end);
                // not getBoundingClientRect as word could wrap
                const rects = range.getClientRects();
                const clickedRect = isClickInRects(rects);
                if (clickedRect) {
                    return word.toLowerCase();
                }
                start = end + 1;
            }
        }
    }

    function isClickInRects(rects) {
        for (let i = 0; i < rects.length; ++i) {
            const r = rects[i];
            if (r.left < x && r.right > x && r.top < y && r.bottom > y) {
                return r;
            }
        }
        return false;
    }

    return '';
}

function isMouseOnElement(element, x, y) {
    if (element !== undefined) {
        if (element.display !== 'none') {
            const rect = element.getBoundingClientRect();
            if (rect.left < x && rect.right > x &&
                rect.top < y && rect.bottom > y) {
                return true;
            }
        }
    }
    return false;
}

function findHoveredWord(parentElt, x, y) {
    //-- checking mouse over popup icon
    if (isMouseOnElement(document.getElementsByClassName("word-up-icon-popup")[0], x, y)) {
        return '';
    }

    //-- checking mouse over popup window
    if (isMouseOnElement(document.getElementsByClassName("word-up-popup")[0], x, y)) {
        return '';
    }

    const textNodes = [].filter.call(parentElt.childNodes, (item) => {
        return (item.nodeType === Node.TEXT_NODE) && item.textContent.replace(newLineSymbolRegex, '').trim()
    });
    if (textNodes.length) {
        for (const textNode of textNodes) {
            const range = document.createRange();
            const words = textNode.textContent.split(/[^a-zA-Z]/g);
            // console.log(words);
            let start = 0;
            let end = 0;
            for (let i = 0, wordsLength = words.length; i < wordsLength; i++) {
                const word = words[i];
                end = start + word.length;
                range.setStart(textNode, start);
                range.setEnd(textNode, end);
                // not getBoundingClientRect as word could wrap
                const rects = range.getClientRects();
                const clickedRect = isClickInRects(rects);
                if (clickedRect) {
                    return [word.toLowerCase(), clickedRect];
                }
                start = end + 1;
            }
        }
    }


    //-- if the Usual method of finding do not find any, we try to find mouse position on our mark layer
    let marks = document.getElementsByClassName("word-up-layer");
    const th = 0;
    for (let j = 0; j < marks.length; j++) {
        const elements = marks[j].children;
        for (let k = 0; k < elements.length; k++) {
            const el = elements[k];
            if (isMouseOnElement(el, x, y)) {
                const markWord = el.getAttribute("data-word-root").toLowerCase();
                const markRect = el.getBoundingClientRect();
                return [markWord, markRect];
            }
        }
    }



    function isClickInRects(rects) {
        for (let i = 0; i < rects.length; ++i) {
            const r = rects[i];
            if (r.left < x && r.right > x && r.top < y && r.bottom > y) {
                return r;
            }
        }
        return false;
    }

    return '';
}

let lastHoveredWord = "";
let isGoingToHide = false;

const handleWordMouseMoves = (e) => {
    const {
        clientX,
        clientY,
        currentTarget,
        eventPhase,
        target,
    } = e;
    if (eventPhase === Event.CAPTURING_PHASE) {
        if (excludedTags.includes(currentTarget.tagName)) {
            return;
        }
    }
    if (excludedTags.includes(target.tagName)) {
        return;
    }
    const wordAndRect = findHoveredWord(target, clientX, clientY);
    const word = wordAndRect[0];
    const rect = wordAndRect[1];
    const wordInDictionary = word ? wordsObj[word] : '';
    if (word && wordInDictionary && word !== lastHoveredWord) {
        const {
            wordRoot,
            id,
            rank,
            phonemic,
        } = wordInDictionary;
        lastHoveredWord = word;
        isGoingToHide = false;
        openIconPopup(e, wordRoot, id, rect, rank, phonemic);
    }
    else if (word !== lastHoveredWord) {
        if (!isGoingToHide) {
            isGoingToHide = true;
            setTimeout((word) => {
                if (word === lastHoveredWord) {
                    let popup = document.querySelector('.word-up-icon-popup');
                    if (popup) {
                        popup.style.display = 'none';
                    }
                    lastHoveredWord = '';
                }
            }, 2000, lastHoveredWord);
        }
    }
};

const isTextNodeVisible = (node, rect) => {
    try {
        const {
            display,
            opacity,
            visibility,
            clip,
            width,
            height,
        } = window.getComputedStyle(node.parentElement);

        if (!node.parentElement.offsetParent) {
            return false;
        }
        if (display === 'none') {
            return false;
        }
        if (visibility === 'hidden') {
            return false;
        }
        if (opacity <= 0) {
            return false;
        }
        //-- ToDo: parse clip to be smaller than 5 px...
        if (clip === "rect(0px, 0px, 0px, 0px)" || clip === "rect(1px, 1px, 1px, 1px)" || (parseInt(width) < 5 && parseInt(height) < 5)) {
            return false;
        }
        if (isHiddenInScroll(node, rect)) {
            return false;
        }
        let ee = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (ee !== null && ee !== node.parentElement && ee.parentElement !== node.parentElement &&
            ee !== node.parentElement.parentElement && ee !== node.parentElement.parentElement.parentElement) {
            return false;
        }
        return true;

    } catch (error) {
        return false;
    }

}

const getHiddenScrollingParent = (el) => {
    const el_style = getComputedStyle(el);
    if (el.offsetHeight < el.scrollHeight &&
        (el_style['overflow-y'] === 'hidden' || el_style['overflow-y'] === 'auto')) {
        return el; //'vertical'
    }
    if (el.offsetWidth < el.scrollWidth &&
        (el_style['overflow-x'] === 'hidden' || el_style['overflow-x'] === 'auto')) {
        return el; //'horizantal'
    }
    if (el.parentElement === null) {
        return null;
    }
    return getHiddenScrollingParent(el.parentElement);
};

const checkIfRectIsInsideParent = (rect, parent) => {
    const prect = parent.getBoundingClientRect();
    if (prect.top <= rect.top && prect.bottom >= rect.bottom &&
        prect.left <= rect.left && prect.right >= rect.right) {
        return true;
    }
    return false;
}

const isHiddenInScroll = (el, rect) => {
    let elp = el.parentElement;
    while (true) {
        const sp = getHiddenScrollingParent(elp);
        if (sp === null) {
            return false;
        }
        if (!checkIfRectIsInsideParent(rect, sp)) {
            return true;
        }
        elp = elp.parentElement;
    }
    return false;
};


var WordLayerArray = {};
var UserAuthToken

const createWordsLayerFromWordObj = () => {
    let wordsLayer = document.querySelector('.word-up-layer');
    WordLayerArray = {};
    if (wordsLayer) {
        removeWordLayer();
        deletePopup();
        wordsLayer = null;
    }

    chromeExtStorage.get('userAuthToken', (value) => {
        const {
            userAuthToken,
        } = value;
        UserAuthToken = userAuthToken;

        if (!userAuthToken || !pageNodeArr.length) {
            return;
        }

        chrome.runtime.sendMessage({
            message: getWordsObjMessage,
        }, (response) => {
            var lastError = chrome.runtime.lastError;
            if (lastError) {
                console.log("Error Content" + lastError.message);
                //createWordsLayerFromWordObj;
                // setTimeout(createWordsLayerFromWordObj, 1000);
                location.reload();
                return;
            }
            //  if (!response) return;
            try {
                wordsObj = response?.payload;
                KnownWords = response?.payload2;
            } catch (error) {
                console.log("error: ", error);
                return;
            }


            pageNodeArr.forEach((pageNode) => {
                const range = document.createRange();
                const words = pageNode.textContent.split(/[^a-zA-Z.]/g);
                let start = 0;
                let end = 0;

                for (let i = 0, wordsLength = words.length; i < wordsLength; i++) {
                    const word = words[i].replace(".", "");
                    end = start + words[i].length;
                    let invisibleMark = false;
                    if (i !== 0 && words[i][0] >= 'A' && words[i][0] <= 'Z') {
                        let j = i - 1;
                        while (j > 0 && words[j] === "") {
                            j--;
                        }
                        if (words[j].slice(-1) !== ".") {
                            invisibleMark = true;
                        }
                    }

                    const wordInDictionary = wordsObj[word.toLowerCase()];
                    if (wordInDictionary) {
                        if (!wordsLayer) {
                            // create layer only if found word in vocabulary
                            wordsLayer = document.createElement('wordup');
                            wordsLayer.className = 'word-up-layer';
                            const wordsLayerCss = {
                                left: 0,
                                position: 'absolute',
                                top: 0,
                                pointerEvents: 'none',
                                zIndex: 100000,
                            };

                            Object.entries(wordsLayerCss).forEach(([key, cssValue]) => {
                                wordsLayer.style[key] = cssValue;
                            });
                        }

                        if (parseInt(wordInDictionary['rank']) < MinRankForAutoHighlight || KnownWords.includes(word.toLowerCase())) {
                            invisibleMark = true;
                        }

                        const {
                            wordRoot,
                            rank,
                        } = wordInDictionary;


                        range.setStart(pageNode, start);
                        range.setEnd(pageNode, end);

                        try {
                            const isElementVisible = isTextNodeVisible(pageNode, range.getClientRects()[0]);
                            if (!isElementVisible) {
                                // TODO: add listener on visibility change
                                return;
                            }
                        } catch (error) {
                            return;
                        }



                        const {
                            height,
                            width,
                            left,
                            top,
                        } = range.getClientRects()[0];

                        const {
                            pageXOffset,
                            pageYOffset,
                        } = window;

                        const singleWordLayer = document.createElement('div');
                        singleWordLayer.dataset.wordRoot = wordRoot;
                        singleWordLayer.dataset.rank = rank;
                        singleWordLayer.style.position = 'absolute';
                        singleWordLayer.style.left = `${pageXOffset + left}px`;
                        singleWordLayer.style.top = `${pageYOffset + top}px`;
                        singleWordLayer.style.height = `${height + 2}px`;
                        singleWordLayer.style.width = `${width}px`;
                        singleWordLayer.style.borderBottom = '2px solid #32BDD2';
                        if (wordInDictionary.unknown) {
                            singleWordLayer.style.borderBottom = '2px solid #FA1E64; ';
                        } else if (invisibleMark) {
                            singleWordLayer.style.borderBottom = '';
                        }
                        wordsLayer.appendChild(singleWordLayer);
                        if (typeof WordLayerArray[wordRoot] !== 'object') {
                            WordLayerArray[wordRoot] = [];
                        }
                        try {
                            WordLayerArray[wordRoot].push(singleWordLayer);
                        } catch (error) {
                            console.log(error);
                        }
                    }
                    start = end + 1;
                }
            });

            if (wordsLayer) {
                document.body.appendChild(wordsLayer);
                // document.body.addEventListener('dblclick', handleWordClick, {
                //   capture: true
                // });
                document.body.addEventListener('mousemove', handleWordMouseMoves, {
                    capture: true
                })
            }
        })
    });
};

var functionIsRunning = true;
var newCall = false;

const refreshWordsLayerFromWordObj = (withNewCall = false) => {
    if (!functionIsRunning) {
        functionIsRunning = true;
        newCall = false;
        let wordsLayer = document.getElementsByClassName('word-up-layer')[0];
        if (!wordsLayer) {
            functionIsRunning = false;
            return;
        }
        // let s = performance.now();
        // let t = performance.now();
        // console.log("Refresh.....................................");
        getAllTextElements();

        // console.log("Step 1 - ", performance.now() - t);
        // t = performance.now();

        if (!UserAuthToken || !pageNodeArr.length) {
            functionIsRunning = false;
            return;
        }
        let newWordLayerArray = {};
        // console.log("Step 2 - ", performance.now() - t);
        // t = performance.now();
        pageNodeArr.forEach((pageNode) => {
            const range = document.createRange();
            const words = pageNode.textContent.split(/[^a-zA-Z.]/g);
            let start = 0;
            let end = 0;

            for (let i = 0, wordsLength = words.length; i < wordsLength; i++) {
                const word = words[i].replace(".", "");
                end = start + words[i].length;
                let invisibleMark = false;
                if (i !== 0 && words[i][0] >= 'A' && words[i][0] <= 'Z') {
                    let j = i - 1;
                    while (j > 0 && words[j] === "") {
                        j--;
                    }
                    if (words[j].slice(-1) !== ".") {
                        invisibleMark = true;
                    }
                }
                if (!wordsObj) return;
                const wordInDictionary = wordsObj[word?.toLowerCase()];
                if (wordInDictionary) {
                    const {
                        wordRoot,
                        rank,
                    } = wordInDictionary;

                    if (parseInt(wordInDictionary['rank']) < MinRankForAutoHighlight || KnownWords.includes(word.toLowerCase())) {
                        invisibleMark = true;
                    }

                    range.setStart(pageNode, start);
                    range.setEnd(pageNode, end);


                    try {
                        const isElementVisible = isTextNodeVisible(pageNode, range.getClientRects()[0]);
                        if (!isElementVisible) {
                            // TODO: add listener on visibility change
                            return;
                        }
                    } catch (error) {
                        return;
                    }

                    const {
                        height,
                        width,
                        left,
                        top,
                    } = range.getClientRects()[0];

                    const {
                        pageXOffset,
                        pageYOffset,
                    } = window;

                    const singleWordLayer = document.createElement('div');
                    singleWordLayer.dataset.wordRoot = wordRoot;
                    singleWordLayer.dataset.rank = rank;
                    singleWordLayer.style.position = 'absolute';
                    singleWordLayer.style.left = `${pageXOffset + left}px`;
                    singleWordLayer.style.top = `${pageYOffset + top}px`;
                    singleWordLayer.style.height = `${height + 2}px`;
                    singleWordLayer.style.width = `${width}px`;
                    singleWordLayer.style.borderBottom = '2px solid #32BDD2';
                    if (wordInDictionary.unknown) {
                        singleWordLayer.style.borderBottom = '2px solid #FA1E64';
                    } else if (invisibleMark) {
                        singleWordLayer.style.borderBottom = '';
                    }
                    if (typeof newWordLayerArray[wordRoot] !== 'object') {
                        newWordLayerArray[wordRoot] = [];
                    }
                    newWordLayerArray[wordRoot].push(singleWordLayer);
                }
                start = end + 1;
            }
        });

        // console.log("Step 3 - ", performance.now() - t);
        // t = performance.now();

        for (const k in WordLayerArray) {
            if (!newWordLayerArray[k]) {
                wordsLayer.querySelectorAll(`[data-word-root="${k}"]`).forEach((layerNode) => layerNode.remove());
                delete WordLayerArray[k];
            } else {
                for (let o = WordLayerArray[k].length - 1; o >= 0; o--) {
                    var isWordFound = false;
                    for (let n = newWordLayerArray[k].length - 1; n >= 0; n--) {
                        if (WordLayerArray[k][o] !== undefined && newWordLayerArray[k][n] !== undefined &&
                            WordLayerArray[k][o].style.top === newWordLayerArray[k][n].style.top &&
                            WordLayerArray[k][o].style.left === newWordLayerArray[k][n].style.left &&
                            WordLayerArray[k][o].style.height === newWordLayerArray[k][n].style.height &&
                            WordLayerArray[k][o].style.width === newWordLayerArray[k][n].style.width) {
                            isWordFound = true;
                            newWordLayerArray[k] = removeFromArray(newWordLayerArray[k], n);
                        }
                    }
                    if (isWordFound === false) {
                        wordsLayer.querySelectorAll(`[data-word-root="${k}"]`).forEach((layerNode) => {
                            if (layerNode.style.left === WordLayerArray[k][o].style.left &&
                                layerNode.style.right === WordLayerArray[k][o].style.right &&
                                layerNode.style.height === WordLayerArray[k][o].style.height &&
                                layerNode.style.width === WordLayerArray[k][o].style.width) {
                                layerNode.remove();
                            }
                        });
                        WordLayerArray[k] = removeFromArray(WordLayerArray[k], o);
                    }
                }
            }
        }

        document.querySelectorAll("wordup > div").forEach((elem) => {
            elem.style.display = '';
        });

        for (const k in newWordLayerArray) {
            if (typeof WordLayerArray[k] !== 'object') {
                WordLayerArray[k] = [];
            }
            for (const i in newWordLayerArray[k]) {
                wordsLayer.appendChild(newWordLayerArray[k][i]);
                WordLayerArray[k].push(newWordLayerArray[k][i])
            }
        }

        newCall = false;
        // console.log("total - ", performance.now() - s);
        setTimeout(() => {
            let endDate = new Date()
            functionIsRunning = false;
            if (newCall) {
                //refreshWordsLayerFromWordObj(true);
            }
        }, 500);
    } else {
        if (withNewCall === false) {
            newCall = true;
        }
    }
};

function removeFromArray(array, index) {
    return index >= 0 ? [
        ...array.slice(0, index),
        ...array.slice(index + 1)
    ] : array;
}




const removeWordLayer = () => {
    const wordsLayer = document.querySelector('.word-up-layer');
    if (wordsLayer) {
        wordsLayer.remove();
    }
};

const updateWordsLayer = (payload) => {
    const {
        knownWords,
        unknownWords,
        wordsObj: updatedWordsObj,
        knownWords: updatedKnowWords,
    } = payload;

    wordsObj = updatedWordsObj;
    KnownWords = updatedKnowWords;


    const wordsLayer = document.querySelector('.word-up-layer');
    if (wordsLayer) {
        if (knownWords.length) {
            knownWords.forEach((word) => {
                wordsLayer.querySelectorAll(`[data-word-root="${word}"]`).forEach((layerNode) => layerNode.remove());
            });
        }
        if (unknownWords.length) {
            unknownWords.forEach((word) => {
                wordsLayer.querySelectorAll(`[data-word-root="${word}"]`).forEach((layerNode) => layerNode.style.borderBottom = '1px dashed red');
            });
        }
    } else {
        createWordsLayerFromWordObj();
    }
};

var removeHiddenCountDown = 10;
const removeHiddenProperty = () => {
    document.body.parentElement.classList.remove("hidden");
    removeHiddenCountDown--;
    setTimeout(() => {
        if (removeHiddenCountDown > 0) {
            removeHiddenProperty();
        }
    }, 1000);
}

var tab_active = true;
var init_called = false;
var timeToRunRefreshScroll = performance.now() + 10000;
var timeToRunRefreshMutation = performance.now() + 100000000;
window.setInterval(function () {
    if (performance.now() > timeToRunRefreshScroll || performance.now() > timeToRunRefreshMutation) {
        timeToRunRefreshScroll = performance.now() + 10000;
        timeToRunRefreshMutation = performance.now() + 100000000;
        refreshWordsLayerFromWordObj();
    }
}, 500);


const init = () => {
    if (init_called) {
        return;
    }
    init_called = true;
    removeHiddenProperty();
    getAllTextElements();
    createWordsLayerFromWordObj();
    onMessage.addListener((request, sender, sendResponse) => {
        sendResponse({
            response: "Ok"
        });

        const {
            message,
            payload,
        } = request;

        switch (message) {
            case activeTabMessage:
                tab_active = payload;
                if (tab_active) {
                    refreshWordsLayerFromWordObj();
                }
                break;
            case userLoggedOutMessage:
                removeWordLayer();
                break;
            case userLoggedInMessage:
                wordsObj = payload;
                createWordsLayerFromWordObj();
                break;
            case updateWordsObjMessage:
                updateWordsLayer(payload);
                break;
        }

    });
    elems = document.getElementsByTagName('*');
    for (let j = 0; j < elems.length; j++) {
        if (getComputedStyle(elems[j])['overflow-y'] === 'scroll' || getComputedStyle(elems[j])['overflow-x'] === 'scroll' || getComputedStyle(elems[j])['overflow'] === 'scroll' ||
            getComputedStyle(elems[j])['overflow-y'] === 'hidden' || getComputedStyle(elems[j])['overflow-x'] === 'hidden' || getComputedStyle(elems[j])['overflow'] === 'hidden' ||
            getComputedStyle(elems[j])['overflow-y'] === 'auto' || getComputedStyle(elems[j])['overflow-x'] === 'auto' || getComputedStyle(elems[j])['overflow'] === 'auto') {
            elems[j].addEventListener('scroll', () => {
                // console.log("scroll");
                document.querySelectorAll("wordup > div").forEach((elem) => {
                    elem.style.display = 'none';
                });
                timeToRunRefreshScroll = performance.now() + 200;
            });
        }
    }
};

if (document.readyState === 'complete') {
    init();
} else {
    window.onload = init;
}
functionIsRunning = false;

window.addEventListener("resize", refreshWordsLayerFromWordObj);

MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

var observer = new MutationObserver(function (mutations, observer) {
    try {
        if (document.readyState === "complete" &&
            !mutations[0].target.className.includes("word-up") &&
            mutations[0].target.className !== "glide__slides" &&
            !mutations[0].target.className.includes("glide")) {
            if (tab_active) {
                timeToRunRefreshMutation = performance.now() + 1000;
            }
        }
    } catch (error) {

    }

});
observer.observe(document.body, {
    subtree: true,
    attributes: true
});