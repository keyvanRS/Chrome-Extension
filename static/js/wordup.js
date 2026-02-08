const GENERATE_KEY_API = 'https://auth.wordupapp.co/ext/generate';
const VERIFY_KEY_API = 'https://auth.wordupapp.co/ext/verify/';
var verificationCallCount = 1000;
var verificationNeedFlag = false;
var LoginFlag = false;
var verificationKey = "";
var email = "example@example.com";

var pageName = location.pathname.split('/').pop();


const hide = (id) => {
    document.getElementById(id).style.display = 'None';
}

const show = (id) => {
    document.getElementById(id).style.display = '';
}

const CheckLoginStatus = () => {
    chrome.storage.local.get(['userAuthToken','email'], function (result) {
        if (result['userAuthToken'] === undefined) {
            LoginFlag = false;
            hide("LoggedIn");
            show("LoggedOut");
            if (pageName === "welcome.html") {
                document.querySelector('.exlogin').style['flex'] = '0 0 400px';
            }
            HandleLoginClick();
        } else {
            LoginFlag = true;
            hide("LoggedOut");
            show("LoggedIn");
            email = result['email'];
            document.getElementById('accountEmail').innerText = email;
            if (pageName === "welcome.html") {
                document.querySelector('.exlogin').style['flex'] = '0 0 300px';
            }
        }
    });
}

CheckLoginStatus();

const UpdateWordList = () => {
    if (document.getElementById("SyncButton").innerText === "Synced"){
        return;
    }
    chrome.storage.local.get(['userAuthPin', 'lastUpdateDate', 'userId'], (values) => {
        const {
            userAuthPin,
            lastUpdateDate,
            userId,
        } = values;
        fetch(`https://sync.wrdp.app/sync/${userId}`)
            .then((response) =>{
                // console.log(response.text());
                fetch(`${VERIFY_KEY_API}${userAuthPin}`, {
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
    
                    let btn = document.getElementById("SyncButton");
                    btn.innerText = "Synced";
                    btn.disabled = true;
                })
                .catch((e) => {
                    console.log('e', e);
                });
            });
    });
}


const VerifyKey = (key) => {
    fetch(`${VERIFY_KEY_API}${key}`, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then((response) => response.json())
        .then((response) => {
            const {
                AuthToken,
                UnknownWords,
                KnownWords,
                UserId,
                Voice,
                Language,
                Email,
                MinRankForAutoHighlight,
            } = response;


            chrome.storage.local.set({
                'userAuthPin': key
            });
            chrome.storage.local.set({
                'userAuthToken': AuthToken
            });
            chrome.storage.local.set({
                'userId': UserId
            });
            chrome.storage.local.set({
                'email': Email
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
                'unknownWordsIds': UnknownWords.split(',').map(Number)
            });
            chrome.storage.local.set({
                'knownWordsIds': KnownWords.split(',').map(Number)
            });
            chrome.storage.local.set({
                'lastUpdateDate': new Date().toString()
            });
            chrome.storage.local.set({
                'hitCount': 0
            });

            verificationNeedFlag = false;
            hide("LoggedOut");
            show("LoggedIn");
            //chrome.tabs.create({url: 'https://cdn-wordup.com/extension/welcome.html?'});
            document.getElementById('accountEmail').innerText = Email;
            
            if (pageName === "welcome.html") {
                document.querySelector('.exlogin').style['flex'] = '0 0 300px';
            }
            let btn = document.getElementById("SyncButton");
            btn.innerText = "Try Sync";
            clearInterval(verifyTimer);
        })
        .catch((e) => {
            if (e instanceof SyntaxError) {
                if (verificationNeedFlag) {
                    // VerifyKey(key);
                } else {
                    HandleLoginClick();
                }
            } else{
                // console.log('e', e);
            }
        });

}



const HandleLogoutClick = (e) => {
    chrome.storage.local.clear();
    hide("loginKeyP");
    hide("LoggedIn");
    show("LoggedOut");
    HandleLoginClick();
}

var verifyTimer ;
 
const HandleLoginClick = () => {
    show("spinner");
    fetch(`${GENERATE_KEY_API}`)
        .then(response => response.text())
        .then((generatedKey) => {
            hide("spinner");
            verificationKey = generatedKey;
            document.getElementById("loginKey").textContent = generatedKey;
            document.getElementById("howToGifDiv").innerHTML = `<img id="howToGif" src="https://cdn-wordup.com/extension/extension-auth.gif" />`;
            show("loginKeyP");
            generatedKey = generatedKey.replace(/-/g, "");
            console.log(generatedKey);
            verificationCallCount = 1000;
            verificationNeedFlag = true;
            verifyTimer = setInterval(VerifyKey, 1000, generatedKey);
            if (pageName === "welcome.html") {
                document.querySelector('.exlogin').style['flex'] = '0 0 400px';
            }
        })
        .catch(err => {
            console.log(err)
        });
}

let logoutButton = document.getElementById('logoutButton');
logoutButton.addEventListener('click', HandleLogoutClick, {
    capture: true
});

let syncButton = document.getElementById('SyncButton');
syncButton.addEventListener('click', UpdateWordList, {
    capture: true
});


// window.onload = () => {
//     if (LoginFlag) {
//         console.log("1");
//         hide("LoggedOut");
//         show("LoggedIn");
//         HandleLoginClick();
//         document.querySelector('.exlogin').style['flex'] = '40%';

//     } else {
//         console.log("2");
//         hide("LoggedIn");
//         show("LoggedOut");
//         hide("spinner");
//         document.getElementById('accountEmail').innerText = email;
//         document.querySelector('.exlogin').style['flex'] = '15%';
//         if (verificationCallCount < 1000) {
//             document.getElementById("loginKey").textContent = verificationKey;
//             show("loginKeyP");
//         }
//         else{
//             hide("loginKeyP");
//         }
//     }
// }