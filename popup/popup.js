/* global chrome, Glide, fetch */

const WORD_KNOWLEDGE_API = 'https://sqs.eu-west-1.amazonaws.com/077176806650/word-knowledge';
const WORD_API = 'https://define.wrdp.app/';
const newImageServer = "https://word-images.cdn-wordup.com/senses/";


var translations = {};
const {
  sendMessage,
} = chrome.runtime;

const {
  local: chromeExtStorage,
} = chrome.storage;

const {
  getWordSenses,
} = {
  getWordSenses: 'getWordSenses',
};

let clickCoordinates;

Date.prototype.DateString = function () {
  var mm = this.getMonth() + 1;
  var dd = this.getDate();

  return [this.getFullYear(), '-',
  (mm > 9 ? '' : '0') + mm, '-',
  (dd > 9 ? '' : '0') + dd
  ].join('');
};

var voicePreference = 'gb';
var HitCount = 5;
chromeExtStorage.get(['voice', 'hitCount'], (value) => {
  const {
    voice,
    hitCount,
  } = value;
  voicePreference = voice;
  HitCount = hitCount;
});

const calExpirationDate = () => {
  return new Date(new Date().getTime() + (5 * 24 * 60 * 60 * 1000)).DateString() + "T12:00:00Z";
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const closePopup = (popup) => {
  const popupVisible = !popup.classList.contains('hidden');
  if (popupVisible) {
    popup.querySelector('.word-up-glide').innerHTML = `<div class="word-up-empty" ><img id="spinner" src="https://cdn-wordup.com/extension/loading.gif" /></div>`;
    popup.classList.add('hidden');
    lastHoveredWord = '';
  }
};

const showPopup = (popup) => {
  const popupHidden = popup.classList.contains('hidden');
  if (popupHidden) {
    popup.classList.remove('hidden');
  }
};

const handleMouseDown = (e) => {
  const {
    clientX,
    clientY,
  } = e;

  clickCoordinates = {
    x: clientX,
    y: clientY,
  };
};

const handleClosePopupOutside = (e, popup) => {
  const {
    clientX,
    clientY,
  } = e;

  if (clickCoordinates.x !== clientX || clickCoordinates.y !== clientY) {
    // prevent popup close on sliders drageng
    return;
  }

  let targetElement = e.target;
  const popupHidden = popup.classList.contains('hidden');
  if (popupHidden) {
    return;
  }

  do {
    if (targetElement === popup) {
      // This is a click inside. Do nothing, just return.
      return;
    }
    targetElement = targetElement.parentNode;
  } while (targetElement);

  closePopup(popup);
};

const renderPopupSlider = (senses) => {
  if (!senses || !senses.length) return;

  const parentClassName = '.word-up-glide';
  const parent = document.querySelector(parentClassName);

  const renderSenses = senses.reduce((acc, item) => {
    const {
      Definition,
      Examples,
      Type,
      ImageSrc,
    } = item;

    return `${acc}
    <li class="glide__slide word-up-sense">
      <p class="word-up-sense__type">${Type}</p>
      <p class="word-up-sense__desc">${Definition}</p>
      <p class="word-up-sense__example">${Examples ? Examples : ""}</p>
      ${ImageSrc ? "<div><img src=" + ImageSrc + "></div>" : ""}
    </li>`;
  }, '');

  const sliderBodyHTML = `
    <div class="glide">
      <div class="glide__track" data-glide-el="track">
        <ul class="glide__slides">
          ${renderSenses}
        </ul>
      </div>
    </div>
  `;

  let rd = senses.length * 300 < 2000 ? senses.length * 300 : 2000;

  parent.innerHTML = sliderBodyHTML;
  new Glide(`${parentClassName} .glide`, {
    dragThreshold: 10,
    animationDuration: 500,
    rewindDuration: rd,
    animationTimingFunc: "linear"
  }).mount();
  setTimeout(() => {
    try {
      var el = document.getElementsByClassName("glide__slides")[0];
      el.style.width = (parseInt(el.style.width, 10) + 15) + 'px';
    } catch (error) {
      console.log("No Slides to adjust the length");
    }
  }, 100);
};

const knewAction = (word, wordId) => {
  SyncWordStatusWithServer(word, wordId, 'Knew', (word, wordId) => {
    const allWordRootElements = document.querySelectorAll(`[data-word-root="${word}"]`);
    if (allWordRootElements) {
      allWordRootElements.forEach((item) => {
        //--TODO here we should update the dictionary that we keep track of all the marks in the page
        item.remove();
      });
    }
    chromeExtStorage.get(['knownWordsIds', 'unknownWordsIds'], (items) => {
      const {
        knownWordsIds,
        unknownWordsIds,
      } = items;
      const wordInUnknownListIndex = unknownWordsIds.indexOf(wordId);
      if (wordInUnknownListIndex !== -1) {
        unknownWordsIds.splice(wordInUnknownListIndex, 1);
      }

      const wordInKnownListIndex = knownWordsIds.indexOf(wordId);
      if (wordInKnownListIndex === -1) {
        knownWordsIds.push(wordId);
      }

      chromeExtStorage.set({
        knownWordsIds,
        unknownWordsIds,
      });
    });
  });
}

var isAlertAlreadyViewed = false;

const viewReloadAlert = () => {
  if (!isAlertAlreadyViewed) {
    isAlertAlreadyViewed = true;
    alert("You need to reload this page to use 𝗪𝗼𝗿𝗱𝗨𝗽 featurs.");
    removeAnyWordUpRelatedElementFromPage();
  }
}

const openPopup = (e, word, wordId, rank, phonemic) => {
  e.stopPropagation();
  const {
    clientX,
    clientY,
  } = e;
  const {
    pageXOffset,
    pageYOffset,
  } = window;
  const defaultPopupWidth = 350;
  const defaultPopupHeight = 400;
  const viewportWidth = (window.innerWidth || document.documentElement.clientWidth);
  const viewportHeight = (window.innerHeight || document.documentElement.clientHeight);
  const popupWidthOutOfViewport = clientX + defaultPopupWidth >= viewportWidth;
  const popupHeightOutOfViewport = clientY + defaultPopupHeight >= viewportHeight;
  const popupTop = popupHeightOutOfViewport ? `${pageYOffset + viewportHeight - defaultPopupHeight - 10}px` : `${pageYOffset + clientY + 5}px`;
  const popupLeft = popupWidthOutOfViewport ? `${pageXOffset + viewportWidth - defaultPopupWidth - 40}px` : `${pageXOffset + clientX + 5}px`;
  const processedWord = capitalizeFirstLetter(word);
  // console.log(processedWord);
  let popup = document.querySelector('.word-up-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.classList.add('word-up-popup');
    try {
      popup.innerHTML = `
          <div class="word-up-popup__header">${processedWord}
          <img class="word-up-popup__voice" src="${chrome.runtime.getURL("img/speakerIcon.png")}" alt="speaker">
          </div>
          <span class="word-up-popup__rank">/${phonemic.split('|')[voicePreference == 'us' ? 1 : 0]}/  #${rank}</span>
          
          <div class="word-up-glide">
            <div class="word-up-empty"><img id="spinner" src="https://cdn-wordup.com/extension/loading.gif" /></div>
          </div>
          <div class="word-up-popup__btn-menu">
            <button class="word-up-btn word-up-btn--learn" type="button">Should learn</button>
            <button class="word-up-btn word-up-btn--knew" type="button">Already knew</button>
          </div>
      `;
    } catch (error) {
      if (error.message === "Extension context invalidated.") {
        viewReloadAlert();
      }
      return;
    }


    const voice = popup.querySelector(".word-up-popup__voice");
    //voice.onclick = () => playPronunciation(word);
    voice.onclick = () => playPronunciation(wordId);


    popup = document.body.appendChild(popup);
    document.body.addEventListener('mousedown', handleMouseDown);
    document.body.addEventListener('mouseup', (e) => handleClosePopupOutside(e, popup));
  } else {
    const popupHeader = popup.querySelector('.word-up-popup__header');
    try {
      popupHeader.innerHTML = processedWord +
        `<img class="word-up-popup__voice" src="${chrome.runtime.getURL("img/speakerIcon.png")}" alt="speaker">`;
    } catch (error) {
      if (error.message === "Extension context invalidated.") {
        viewReloadAlert();
      }
      return;
    }


    popup.querySelector('.word-up-popup__rank').textContent = "/" + phonemic + "/  #" + rank
    const voice = popup.querySelector(".word-up-popup__voice");
    voice.onclick = () => playPronunciation(wordId);

    showPopup(popup);
  }

  popup.style.top = popupTop;
  popup.style.left = popupLeft;

  const alreadyKnewBtn = popup.querySelector('.word-up-btn--knew');
  alreadyKnewBtn.onclick = () => {
    knewAction(word, wordId);
    closePopup(popup);
  };

  const shouldLearnBtn = popup.querySelector('.word-up-btn--learn');
  shouldLearnBtn.onclick = () => {
    SyncWordStatusWithServer(word, wordId, 'Learn', (word, wordId) => {
      closePopup(popup);
      const allWordRootElements = document.querySelectorAll(`[data-word-root="${word}"]`);
      if (allWordRootElements) {
        allWordRootElements.forEach((item) => {
          item.style.borderBottom = '1px dashed red';
        });
      }
      chromeExtStorage.get(['knownWordsIds', 'unknownWordsIds'], (items) => {
        const {
          knownWordsIds,
          unknownWordsIds,
        } = items;

        const wordInUnknownListIndex = unknownWordsIds.indexOf(wordId);
        if (wordInUnknownListIndex !== -1) {
          return;
        }
        const wordInKnownListIndex = knownWordsIds.indexOf(wordId);
        if (wordInKnownListIndex !== -1) {
          knownWordsIds.splice(wordInKnownListIndex, 1);
        }
        unknownWordsIds.push(wordId);

        chromeExtStorage.set({
          knownWordsIds,
          unknownWordsIds,
        });
      });
    });

  };
  manualFetchData(word);
  // sendMessage({
  //   message: getWordSenses,
  //   payload: word,
  // }, (response) => {
  //   var lastError = chrome.runtime.lastError;
  //   if (lastError) {
  //     console.log("Error Content1" + lastError.message);
  //     manualFetchData(word);
  //     //return;
  //   }
  //   const {
  //     Senses,
  //     isLoggedIn,
  //   } = response;
  //   if (Senses) {
  //     renderPopupSlider(Senses);
  //   }
  //   else if (isLoggedIn == false) {
  //     showLoginPage();
  //   }
  // });
};


const manualFetchData = (payload) => {
  var myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");

  var requestOptions = {
    method: 'GET',
    redirect: 'follow'
  };

  fetch(`${WORD_API}${payload}`, requestOptions).then((response) => response.json())
    .then((response) => {
      const {
        Senses,
      } = response;

      //--Add image to the senses
      for (const def in Senses) {
        if (Senses.hasOwnProperty(def)) {
          const element = Senses[def];
          let url = `${newImageServer}${element.ID}.webp?v=1`;
          Senses[def].ImageSrc = url;

        }
      }

      //--Adding Translation to the senses
      if (translations[payload] !== undefined) {
        let ty = "Translation";
        if (fullLanguage[userLanguage] !== undefined) {
          ty = fullLanguage[userLanguage];
        }
        Senses.push({
          "Definition": translations[payload],
          "Type": ty
        });
      }
      renderPopupSlider(Senses);

    })
    .catch((e) => {
      console.log('e', e);
    });


}


const deletePopup = () => {
  const popup = document.querySelector('.word-up-popup');
  if (popup) {
    popup.remove();
  }
};


// var male = true;
// const playPronunciation = (word) => {
//   let link = "https://cdn-wordup.com/audio/" + voicePreference + "-";
//   link += male ? "m" : "f";
//   male = !male;
//   link += "/" + word + ".mp3";
//   var audio = new Audio(link);
//   audio.play();
// }

var male = true;
const playPronunciation = (wordId) => {
  let link = "https://speech.cdn-wordup.com/words/all/" + voicePreference + "/";
  link += male ? "m" : "f";
  male = !male;
  link += "/" + wordId + ".mp3";
  var audio = new Audio(link);
  audio.play();
}

const showLoginPage = () => {
  chromeExtStorage.get(['userAuthToken', 'userId'], (values) => {
    const {
      userAuthToken,
      userId,
    } = values;
    if (userAuthToken && userId) {
      return;
    }
    chrome.storage.local.clear();
    wordsObj = {};
    removeAnyWordUpRelatedElementFromPage();

    var r = confirm("To Use 𝗪𝗼𝗿𝗱𝗨𝗽 features you need to login.\n𝗗𝗼 𝘆𝗼𝘂 𝘄𝗮𝗻𝘁 𝘁𝗼 𝗹𝗼𝗴𝗶𝗻 𝗻𝗼𝘄?");
    if (r == true) {
      window.open(chrome.runtime.getURL("welcome.html"), '_blank');
    } else {
    }
  });

}

const removeAnyWordUpRelatedElementFromPage = () => {
  document.querySelectorAll("wordup").forEach((elem) => {
    elem.remove();
  });
  let el = document.getElementsByClassName("word-up-icon-popup");
  if (el.length > 0) {
    el[0].remove();
  }

  el = document.getElementsByClassName("word-up-popup");
  if (el.length > 0) {
    el[0].remove();
  }
}


const SyncWordStatusWithServer = (word, wordId, decision, callback) => {
  try {
    chromeExtStorage.get(['userAuthToken', 'userId'], (values) => {
      const {
        userAuthToken,
        userId,
      } = values;
      if (userAuthToken && userId) {
        var details = {
          'Action': 'SendMessage',
          'Version': '2012-11-05',
          'Expires': calExpirationDate(),
          'MessageBody': `{
              "UserId":"${userId}", 
              "Word":"${word}", 
              "Decision":"${decision}", 
              "AuthToken":"${userAuthToken}"
          }`
        };

        var formBody = [];
        for (var property in details) {
          var encodedKey = encodeURIComponent(property);
          var encodedValue = encodeURIComponent(details[property]);
          formBody.push(encodedKey + "=" + encodedValue);
        }
        formBody = formBody.join("&");

        fetch(`${WORD_KNOWLEDGE_API}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: formBody,
        })
          .then(response => response.text())
          .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
          .then((response) => {
            if (response.getElementsByTagName("MessageId")[0] !== undefined) {
              console.log("Successfully send " + decision + " message of \"" + word + "\" to server.");
              callback(word, wordId);
            } else {
              console.log("Failed");
              return;
            }
          })
          .catch((e) => {
            console.log('e', e);
            return;
          });
      } else {
        showLoginPage();
        return;
      }
    });
  } catch (error) {
    if (error.message === "Extension context invalidated.") {
      viewReloadAlert();
    }
    return;
  }

}

const faviconUrl = chrome.runtime.getURL("img/favicon.png");

const openIconPopup = (e, word, wordId, rect, rank, phonemic) => {
  e.stopPropagation();
  //const clientX = rect.width > 30 ? rect.right - 30: rect.right - rect.width;
  const clientX = rect.right - rect.width / 2 - 32;
  const clientY = rect.top - 30;

  const {
    pageXOffset,
    pageYOffset,
  } = window;
  const defaultPopupWidth = 50;
  const defaultPopupHeight = 50;
  const viewportWidth = (window.innerWidth || document.documentElement.clientWidth);
  const viewportHeight = (window.innerHeight || document.documentElement.clientHeight);
  const popupWidthOutOfViewport = clientX + defaultPopupWidth >= viewportWidth;
  const popupHeightOutOfViewport = clientY + defaultPopupHeight >= viewportHeight;
  const popupTop = popupHeightOutOfViewport ? `${pageYOffset + viewportHeight - defaultPopupHeight - 10}px` : `${pageYOffset + clientY + 5}px`;
  const popupLeft = popupWidthOutOfViewport ? `${pageXOffset + viewportWidth - defaultPopupWidth - 40}px` : `${pageXOffset + clientX + 5}px`;
  let popup = document.querySelector('.word-up-icon-popup');


  if (!popup) {
    popup = document.createElement('div');
    popup.classList.add('word-up-icon-popup');
    try {
      if (HitCount < 5) {
        popup.innerHTML = `
          <div title="Should learn">
            <img id="icon-popup_check" class="word-up-icon-popup_image" src="${chrome.runtime.getURL("img/Check.png")}" alt="Check" >
          </div>  
          <div title="Already Knew">
            <img id="icon-popup_knew" class="word-up-icon-popup_image" src="${chrome.runtime.getURL("img/Knew.png")}" alt="Knew" >
          </div>
      `;
      } else {
        popup.innerHTML = `
            <div title="Should learn">
              <img id="icon-popup_check" class="word-up-icon-popup_image" src="${chrome.runtime.getURL("img/Check.png")}" alt="Check">
            </div>  
            <div title="Already Knew">
              <img id="icon-popup_knew" class="word-up-icon-popup_image" src="${chrome.runtime.getURL("img/Knew.png")}" alt="Knew">
            </div>
        `;
      }
    } catch (error) {
      if (error.message === "Extension context invalidated.") {
        viewReloadAlert();
      }
      return;
    }


    popup = document.body.appendChild(popup);
  } else {
    popup.style.display = '';
  }
  const imageIcon = popup.querySelector('#icon-popup_check');
  imageIcon.onclick = () => {
    popup.style.display = 'none';
    openPopup(e, word, wordId, rank, phonemic);
    increaseHitCount();
  };

  const imageIconKnew = popup.querySelector('#icon-popup_knew');
  imageIconKnew.onclick = () => {
    popup.style.display = 'none';
    knewAction(word, wordId);
    increaseHitCount();
  };

  popup.style.top = popupTop;
  popup.style.left = popupLeft;


};

const increaseHitCount = () => {
  if (HitCount < 5) {
    try {
      chromeExtStorage.get('hitCount', (value) => {
        const {
          hitCount,
        } = value;
        HitCount = hitCount;
        if (HitCount < 5) {
          HitCount++;
          chrome.storage.local.set({
            'hitCount': HitCount
          });
        }
        if (HitCount >= 5) {
          document.querySelector('.word-up-icon-popup').remove();
        }
      });
    } catch (error) {
      if (error.message === "Extension context invalidated.") {
        viewReloadAlert();
      }
      return;
    }
  }
}