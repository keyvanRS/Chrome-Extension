/* global chrome */

const WORD_API = 'https://define.wrdp.app/';
const ALLOWED_URLS = ['http://*/*', 'https://*/*', 'file:///*'];

const {
  onInstalled,
  onMessage,
  onStartup,
} = chrome.runtime;

const {
  executeScript,
  insertCSS,
  sendMessage,
  query: tabsQuery,
} = chrome.tabs;

const {
  local: chromeExtStorage,
} = chrome.storage;

// const {
//   fetch,
// } = window;

const wordsObj = {};
const knownWords = [];
var translations = {};
const fullLanguage = {
  'af': 'Afrikaans',
  'sq': 'Albanian',
  'am': 'Amharic',
  'ar': 'Arabic',
  'hy': 'Armenian',
  'az': 'Azerbaijani',
  'eu': 'Basque',
  'bn': 'Bengali (Bangla)',
  'bs': 'Bosnian',
  'bg': 'Bulgarian',
  'ca': 'Catalan',
  'ceb': 'Cebuano',
  'zh-CN': 'Chinese',
  'co': 'Corsican',
  'hr': 'Croatian',
  'cs': 'Czech',
  'da': 'Danish',
  'nl': 'Dutch',
  'en': 'English',
  'eo': 'Esperanto',
  'et': 'Estonian',
  'fi': 'Finnish',
  'fr': 'French',
  'fy': 'Frisian',
  'gl': 'Galician',
  'ka': 'Georgian',
  'de': 'German',
  'el': 'Greek',
  'gu': 'Gujarati',
  'ht': 'Haitian Creole',
  'ha': 'Hausa',
  'haw': 'Hawaiian',
  'iw': 'Hebrew',
  'hi': 'Hindi',
  'hmn': 'Hmong',
  'hu': 'Hungarian',
  'is': 'Icelandic',
  'ig': 'Igbo',
  'id': 'Indonesian',
  'ga': 'Irish',
  'it': 'Italian',
  'ja': 'Japanese',
  'jw': 'Javanese',
  'kn': 'Kannada',
  'kk': 'Kazakh',
  'km': 'Khmer',
  'ko': 'Korean',
  'ku': 'Kurdish',
  'lo': 'Lao',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'lb': 'Luxembourgish',
  'mk': 'Macedonian',
  'mg': 'Malagasy',
  'ms': 'Malay',
  'ml': 'Malayalam',
  'mi': 'Maori',
  'mr': 'Marathi',
  'mn': 'Mongolian',
  'my': 'Myanmar',
  'ne': 'Nepali',
  'no': 'Norwegian',
  'ny': 'Nyanja (Chichewa)',
  'ps': 'Pashto',
  'fa': 'Persian (Farsi)',
  'pl': 'Polish',
  'pt': 'Portuguese',
  'pa': 'Punjabi',
  'ro': 'Romanian',
  'ru': 'Russian',
  'sm': 'Samoan',
  'gd': 'Scots Gaelic',
  'sr': 'Serbian',
  'st': 'Sesotho',
  'sn': 'Shona',
  'sd': 'Sindhi',
  'si': 'Sinhala (Sinhalese)',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'so': 'Somali',
  'es': 'Spanish',
  'sw': 'Swahili',
  'sv': 'Swedish',
  'tl': 'Tagalog (Filipino)',
  'tg': 'Tajik',
  'ta': 'Tamil',
  'te': 'Telugu',
  'th': 'Thai',
  'tr': 'Turkish',
  'uk': 'Ukrainian',
  'ur': 'Urdu',
  'uz': 'Uzbek',
  'vi': 'Vietnamese',
  'cy': 'Welsh',
  'xh': 'Xhosa',
  'yi': 'Yiddish',
  'yo': 'Yoruba',
  'zu': 'Zulu'
};
var userLanguage = "en";
const imageServer = "https://word-images.cdn-wordup.com/";
const newImageServer = "https://word-images.cdn-wordup.com/senses/";
const mp4ToGifServer = "https://asgif.wrdp.app?mp4=";

const makeFullImageURL = (url) => {
  if (url.charAt(0) == '/') {
    url = url.substring(1);
  }
  if (url.startsWith("https://")) {
    if (url.endsWith(".mp4") || url.includes(".mp4?")) {
      return mp4ToGifServer + url;
    }
    return url;
  } else if (url.startsWith("opt/")) {
    return imageServer + url;
  }
  return imageServer + "opt/" + url;
}

const {
  getWordSensesMessage,
  getWordsObjMessage,
  updateWordsObjMessage,
  userLoggedInMessage,
  userLoggedOutMessage,
} = {
  getWordSensesMessage: 'getWordSenses',
  getWordsObjMessage: 'getWordsObj',
  updateWordsObjMessage: 'updateWordsObj',
  userLoggedInMessage: 'userLoggedIn',
  userLoggedOutMessage: 'userLoggedOut',
};

const sendMessageToAllTabs = (messageObj) => {
  if (!messageObj || typeof messageObj !== 'object') {
    return;
  }
  tabsQuery({
    active: true,
    currentWindow: true
  }, (tabs) => {
    for (let i = 0, tabsLength = tabs.length; i < tabsLength; ++i) {
      if (tabs[i].url == null || tabs[i].url == "" || tabs[i].url?.startsWith("chrome")) continue;
      sendMessage(tabs[i].id, messageObj);
    }
  });
};

var isLoggedIn = false;

const loadTranslations = () => {
  chromeExtStorage.get(['language'], (values) => {
    const {
      language,
    } = values;
    userLanguage = language;
    if (language !== undefined && language !== 'en' && fullLanguage[language] !== undefined) {
      try {
        fetch(`https://cdn-wordup.com/translations/v3/${language}.json`)
          .then((response) => response.json())
          .then((result) => {
            translations = {
              ...result
            };
          });
      } catch (error) {
      }
    }
  });
}

const setWordDatabase = (callback) => {
  chromeExtStorage.get(['knownWordsIds', 'unknownWordsIds'], (values) => {
    const {
      knownWordsIds,
      unknownWordsIds,
    } = values;

    if (knownWords) {
      isLoggedIn = true;
    }

    loadTranslations();

    fetch('/KnownNames.txt')
      .then((response) => response.text())
      .then((result) => {
        result.trim().split('\n').forEach((item) => {
          knownWords.push(item.trim());
        });
      });


    fetch('/wordsData.txt')
      .then((response) => response.text())
      .then((result) => {
        result.trim().split('\n').forEach((item) => {
          const wordAsArr = item.split('|');
          const wordId = +wordAsArr[0];
          if (knownWordsIds && knownWordsIds.includes(wordId)) {
            return;
          }

          const wordRank = wordAsArr[1];
          const wordRoot = wordAsArr[2];
          const wordForms = wordAsArr[3];
          const wordPhonemic = wordAsArr[7] + "|" + wordAsArr[8];
          const wordUnknown = knownWordsIds && unknownWordsIds.includes(wordId);

          wordsObj[wordRoot] = {
            wordRoot,
            id: wordId,
            unknown: wordUnknown,
            rank: wordRank,
            phonemic: wordPhonemic,
          };

          if (wordForms) {
            wordForms.split(',').forEach((form) => {
              wordsObj[form] = {
                wordRoot,
                id: wordId,
                unknown: wordUnknown,
                rank: wordRank,
                phonemic: wordPhonemic,
              };
            });
          }
        });
      })
      .then(callback);
  });
};

const getWordObjByUserKnowledgeWords = (changes) => {
  const {
    knownWordsIds,
    unknownWordsIds,
  } = changes;

  if (!knownWordsIds && !unknownWordsIds) {
    return;
  }

  const payload = {
    wordsObj,
    knownWords: [],
    unknownWords: [],
  };

  let {
    newValue: knownWordIdsToFilter,
    oldValue: oldKnownWordIdsToFilter,
  } = changes.knownWordsIds || {};

  let {
    newValue: unknownWordIdsToFilter,
    oldValue: oldUnknownWordIdsToFilter,
  } = changes.unknownWordsIds || {};

  if (knownWordIdsToFilter && oldKnownWordIdsToFilter) {
    knownWordIdsToFilter = knownWordIdsToFilter.filter((item) => oldKnownWordIdsToFilter.indexOf(item) === -1);
  }

  if (unknownWordIdsToFilter && oldUnknownWordIdsToFilter) {
    unknownWordIdsToFilter = unknownWordIdsToFilter.filter((item) => oldUnknownWordIdsToFilter.indexOf(item) === -1);
  }

  Object.entries(wordsObj).forEach(([key, value]) => {
    const {
      id,
    } = value;
    if (knownWordIdsToFilter && knownWordIdsToFilter.indexOf(id) !== -1) {
      const {
        wordRoot,
      } = value;
      if (payload.knownWords.indexOf(wordRoot) === -1) {
        payload.knownWords.push(wordRoot);
      }
      delete wordsObj[key];
      return;
    }
    if (unknownWordIdsToFilter && unknownWordIdsToFilter.indexOf(id) !== -1) {
      const {
        wordRoot,
      } = value;
      if (payload.unknownWords.indexOf(wordRoot) === -1) {
        payload.unknownWords.push(wordRoot);
      }
      wordsObj[key].unknown = true;
    }
  });

  return payload;
};

const storageListener = () => {
  chromeExtStorage.onChanged.addListener((changes) => {
    const {
      newValue: userAuthToken,
      oldValue: userOldToken,
    } = changes.userAuthToken || {};

    const {
      knownWordsIds,
      unknownWordsIds,
    } = changes;

    const userLoggedIn = !!userAuthToken;
    const userIsLoggedOut = !!userOldToken;
    const knowledgeWordsChanged = knownWordsIds || unknownWordsIds;
    let payload;

    if (userLoggedIn) {
      isLoggedIn = true;
      payload = getWordObjByUserKnowledgeWords(changes);
      loadTranslations();
      sendMessageToAllTabs({
        payload,
        message: userLoggedInMessage,
      });
    } else if (userIsLoggedOut) {
      isLoggedIn = false;
      sendMessageToAllTabs({
        message: userLoggedOutMessage,
      });
    } else if (knowledgeWordsChanged) {
      payload = getWordObjByUserKnowledgeWords(changes);
      // TODO: create update request here
      sendMessageToAllTabs({
        payload,
        message: updateWordsObjMessage,
      });
    }
  });
};

const UpdateWordListOnceADay = (force = false) => {
  chromeExtStorage.get(['userAuthPin', 'lastUpdateDate', 'userId'], (values) => {
    const {
      userAuthPin,
      lastUpdateDate,
      userId,
    } = values;
    if (userId && userAuthPin) {
      if ((new Date() - new Date(lastUpdateDate)) > 86400000 || force) {
        fetch(`https://sync.wrdp.app/sync/${userId}`)
          .then((response) => {
            fetch(`https://auth.wordupapp.co/ext/verify/${userAuthPin}`, {
              method: "GET",
              headers: {
                'Content-Type': 'application/json',
              },
            })
              .then((response) => response.json())
              .then((response) => {
                const {
                  UnknownWords,
                  KnownWords,
                  Voice,
                  MinRankForAutoHighlight,
                  Language,
                } = response;

                chrome.storage.local.set({
                  'unknownWordsIds': UnknownWords.split(',').map(Number)
                });
                chrome.storage.local.set({
                  'knownWordsIds': KnownWords.split(',').map(Number)
                });
                chrome.storage.local.set({
                  'voice': Voice
                });
                chrome.storage.local.set({
                  'minRankForAutoHighlight': MinRankForAutoHighlight
                });
                chrome.storage.local.set({
                  'language': Language
                });
                chrome.storage.local.set({
                  'lastUpdateDate': new Date().toString()
                });
              })
              .catch((e) => {
                console.log('e', e);
              });

          });
      }
    }

  });
}

const messageListener = () => {
  onMessage.addListener(
    (request, sender, sendResponse) => {
      const {
        message,
        payload,
      } = request;
      // console.log("The Message is: ", message);
      switch (message) {
        case getWordsObjMessage:
          sendResponse({
            payload: wordsObj,
            payload2: knownWords,
          });
          break;

        case getWordSensesMessage:
          // console.log(`${WORD_API}${payload}`);
          if (isLoggedIn) {
            fetch(`${WORD_API}${payload}`, {
              headers: {
                'Content-Type': 'application/json',
              },
            })
              .then((response) => response.json())
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


                // fetch(`https://word-images.cdn-wordup.com/opt/${payload}/selected.json`)
                //   .then((response) => response.json())
                //   .then((response) => {
                //     //--Add image to the senses
                //     for (const def in Senses) {
                //       if (Senses.hasOwnProperty(def)) {
                //         const element = Senses[def];
                //         if (response[element.ID] !== undefined) {
                //           let url = makeFullImageURL(response[element.ID]);
                //           Senses[def].ImageSrc = url;
                //         }
                //       }
                //     }

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
                sendResponse({
                  Senses,
                });
                // });
              })
              .catch((e) => {
                console.log('e', e);
              });

            UpdateWordListOnceADay();

            return true;
          }
          else {
            sendResponse({
              isLoggedIn,
            });
          }
      }
    },
  );
};

// const injectContentFiles = () => {
//   const extManifest = chrome.app.getDetails();
//   const injectInTab = (tab) => {
//     const {
//       id: tabId,
//     } = tab;

//     const manifestStyles = extManifest.content_scripts[0].css;
//     const manifestScripts = extManifest.content_scripts[0].js;

//     manifestStyles.forEach((file) => {
//       insertCSS(tabId, {
//         file,
//       });
//     });

//     manifestScripts.forEach((file) => {
//       executeScript(tabId, {
//         file,
//       });
//     });
//   };

//   tabsQuery({
//     active: true,
//     currentWindow: true,
//     url: ALLOWED_URLS,
//   }, (tabs) => {
//     tabs.forEach((tab) => injectInTab(tab));
//   });
// };

onStartup.addListener(() => {
  setWordDatabase(() => {
    storageListener();
    messageListener();
  });
});




const injectContentScripts = async () => {
  for (const cs of chrome.runtime.getManifest().content_scripts) {
    for (const tab of await chrome.tabs.query({ url: cs.matches })) {
      if (tab.url == null || tab.url == "" || tab.url?.startsWith("https://chrome")
        || tab.url?.startsWith("chrome")) continue;
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: cs.js
      });
    }
  }
}

onInstalled.addListener(async (details) => {

  await injectContentScripts();
  const {
    reason,
  } = details;
  chrome.tabs.create({
    url: "welcome.html"
  });
  chrome.action.onClicked.addListener(function (tab) {
    chrome.tabs.create({
      url: "welcome.html"
    });
  });
  if (reason === 'install' || reason === 'update') {
    UpdateWordListOnceADay(true);
    setWordDatabase(() => {
      storageListener();
      messageListener();
      //  injectContentFiles(details);
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  setWordDatabase(() => {
    storageListener();
    messageListener();
  });
})

function onError(error) {
  // console.error(`Error: ${error}`);
}

chrome.tabs.onActivated.addListener(async function (activeInfo) {

  setWordDatabase(() => {
    storageListener();
    messageListener();
  });

  tabsQuery({}, (tabs) => {
    for (let i = 0, tabsLength = tabs.length; i < tabsLength; ++i) {
      if (tabs[i].url == null || tabs[i].url == "" || tabs[i].url?.startsWith("chrome")) continue;
      if (activeInfo.tabId !== tabs[i].id) {
        // console.log('2-' + tabs[i].url)
        sendMessage(tabs[i].id, {
          message: "tabActivated",
          payload: false
        }).then((response) => {
          // console.log("Message from the content script:");
          // console.log(response.response);
        })
          .catch(onError);
      }
    }
  });

  var tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url == null || tab.url == "" || tab.url?.startsWith("chrome")) return;
  // console.log('1-' + tab.url)
  sendMessage(activeInfo.tabId, {
    message: "tabActivated",
    payload: true
  }).then((response) => {
    // console.log("Message from the content script:");
    // console.log(response.response);
  })
    .catch(onError);
});