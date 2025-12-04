// game_logic_phone.js
// Combined game logic for Gay Ejypti Spades
// Includes: continuous reel, slot placement, foresight overlay, favorite games overlay
// Now includes: screen fade-out + foresight fade-in when right torch is clicked
// Fixes: hide reels & slots beneath overlays so gameplay doesn't show under overlays
// Favorites overlay now appears after 7 seconds (previously 10s)

(function () {
  // CONFIG
  const TOTAL_CARDS = 262;
  const INITIAL_PICKS = 8;
  const EXTRA_DRAWS = 52;
  const MAX_TOTAL_DRAWS = INITIAL_PICKS + EXTRA_DRAWS; // 60

  const CARD_COUNTS = {
    spade: 11,
    pyramid: 3,
    pharaoh: 3,
    prideflag: 5,
    anch: 8,
    rings: 21,
    sunflowerman: 3,
    gaycouple: 20,
    anubis: 15,
    oillamp: 101,
    pottery: 72,
  };

  const CARD_IMAGES = {
    spade: "card_spade.png",
    pyramid: "card_pyramid.png",
    pharaoh: "card_pharaoh.png",
    prideflag: "card_prideflag.png",
    anch: "card_anch.png",
    rings: "card_rings.png",
    sunflowerman: "card_sunflowerman.png",
    gaycouple: "card_gaycouple.png",
    anubis: "card_anubis.png",
    oillamp: "card_oillamp.png",
    pottery: "card_pottery.png",
    back: "card_back.png",
    torch: "gayejyptispades_torch.png",
    heart: "gayejyptispades_heart.png",
  };

  const PREFERRED_SLOT = {
    spade: 1,
    pyramid: 2,
    pharaoh: 3,
    prideflag: 4,
    anch: 5,
    rings: 6,
    sunflowerman: 7,
    gaycouple: 8,
  };

  const SLOT_LEFTS = {
    1: 10,
    2: 50,
    3: 90,
    4: 130,
    5: 170,
    6: 210,
    7: 250,
    8: 290,
  };

  const SLOT_WIDTH = 30;
  const SLOT_HEIGHT = 45;
  const BOTTOM_OFFSET = 20;

  const REEL_TOP = 100;
  const BACK_CARD_WIDTH = 150;
  const BACK_CARD_HEIGHT = 225;
  const REEL_GAP = 8;

  // STATE
  let deck = [];
  let drawsDone = 0;
  let initialPicksDone = 0;
  let slots = Array(9).fill(null);
  let nextCardId = 1;
  let leftTorchLit = false;
  let reelsEnabled = true;
  let gameContentEl = null;

  const FAVORITES_KEY = 'favoriteGames';
  const MAX_FAVORITES = 5;

  // UTILITIES
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function buildDeck() {
    const list = [];
    Object.entries(CARD_COUNTS).forEach(([k, v]) => {
      for (let i = 0; i < v; i++) list.push(k);
    });
    shuffle(list);
    return list;
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(arr) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr));
    } catch {}
  }

  function addFavoriteGame(cardTypesArray) {
    if (!Array.isArray(cardTypesArray) || cardTypesArray.length !== 8) return;
    const favs = loadFavorites();
    favs.unshift(cardTypesArray);
    while (favs.length > MAX_FAVORITES) favs.pop();
    saveFavorites(favs);
    return favs;
  }

  function chooseSlotFor(type) {
    const pref = PREFERRED_SLOT[type];
    if (pref && !slots[pref]) return pref;
    for (let i = 1; i <= 8; i++) if (!slots[i]) return i;
    return 1;
  }

  function discardSlot(slotNum) {
    const st = slots[slotNum];
    if (!st) return;
    try {
      st.imgEl.remove();
    } catch {}
    slots[slotNum] = null;
    leftTorchLit = false;
    const left = document.getElementById('leftTorch');
    if (left) left.style.filter = '';
    const msg = document.getElementById('gameMessage');
    if (msg) msg.textContent = `Discarded slot ${slotNum}.`;
  }

  function checkReadyForFinalize() {
    let filled = 0;
    let hasSpade = false;
    for (let i = 1; i <= 8; i++) {
      if (slots[i]) {
        filled++;
        if (slots[i].type === 'spade') hasSpade = true;
      }
    }
    return filled >= 8 && hasSpade;
  }

  function renderFavoriteOverlay(container) {
    const favOverlay = container.querySelector('#favoriteGamesOverlay');
    const favList = container.querySelector('#favoriteListRows');
    if (!favOverlay || !favList) return;
    favList.innerHTML = '';
    let favs = loadFavorites() || [];
    if (!favs.length) {
      const no = document.createElement('div');
      no.textContent = 'No favorite games yet';
      no.style.opacity = '0.6';
      favList.appendChild(no);
      return;
    }
    favs = favs.slice(0, MAX_FAVORITES);
    favs.forEach((one) => {
      const rowWrap = document.createElement('div');
      rowWrap.className = 'favoriteRow';
      const heart = document.createElement('img');
      heart.className = 'favoriteHeart';
      heart.src = CARD_IMAGES.heart;
      heart.alt = 'heart';
      heart.style.width = '30px';
      heart.style.height = '20px';
      heart.style.flex = '0 0 20px';
      rowWrap.appendChild(heart);
      const cardsRow = document.createElement('div');
      cardsRow.className = 'favoriteCardsRow';
      for (let i = 0; i < 8; i++) {
        const t = one[i] || 'empty';
        const im = document.createElement('img');
        im.className = 'favoriteCardThumb';
        im.src = (t !== 'empty') ? (CARD_IMAGES[t] || CARD_IMAGES.back) : CARD_IMAGES.back;
        im.alt = t;
        im.style.pointerEvents = 'none';
        cardsRow.appendChild(im);
      }
      rowWrap.appendChild(cardsRow);
      favList.appendChild(rowWrap);
    });
  }

  function finalize(container) {
    const foresightEl = (gameContentEl || container).querySelector('#foresightOverlay');
    const fRow = foresightEl ? foresightEl.querySelector('#foresightRow') : null;
    const finalArr = [];
    for (let i = 1; i <= 8; i++) finalArr.push(slots[i] || null);

    if (foresightEl) foresightEl.style.display = 'flex';
    if (fRow) {
      fRow.innerHTML = '';
      finalArr.forEach((s) => {
        const wrap = document.createElement('div');
        wrap.style.width = SLOT_WIDTH + 'px';
        wrap.style.height = SLOT_HEIGHT + 'px';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.justifyContent = 'center';
        wrap.style.border = '1px solid rgba(255,255,255,0.06)';
        wrap.style.boxSizing = 'border-box';
        if (s && s.type) {
          const im = document.createElement('img');
          im.src = CARD_IMAGES[s.type] || CARD_IMAGES.back;
          im.className = 'foresightCard';
          im.alt = s.type;
          wrap.appendChild(im);
        }
        fRow.appendChild(wrap);
      });
    }

    const savedTypes = finalArr.map(s => (s && s.type) ? s.type : 'empty');

    // Show favorites after 60 seconds (was 10s)
    setTimeout(() => {
      if (foresightEl) {
        foresightEl.style.transition = 'opacity 500ms ease';
        foresightEl.style.opacity = '0';
        setTimeout(() => { if (foresightEl) foresightEl.style.display = 'none'; }, 520);
      }
      addFavoriteGame(savedTypes);
      renderFavoriteOverlay(gameContentEl || container);
      const favOverlay = (gameContentEl || container).querySelector('#favoriteGamesOverlay');
      if (favOverlay) {
        favOverlay.style.display = 'flex';
        favOverlay.style.opacity = '0';
        favOverlay.style.transition = 'opacity 6000ms ease';
        requestAnimationFrame(() => { favOverlay.style.opacity = '1'; });
      }
    }, 60000);
  }

  // UI creation
  function createUI(container) {
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.height = '100%';

    // ============= TOP LOGO BUTTON + HOVER SWAP + REFRESH GAME ============
    const topLogo = document.createElement('img');
    topLogo.src = "gayejyptispades_spadelogomenu.png";
    topLogo.id = "topLogoButton";
    topLogo.style.position = "absolute";
    topLogo.style.top = "5px";
    topLogo.style.left = "5px";
    topLogo.style.width = "50px";
    topLogo.style.height = "50px";
    topLogo.style.cursor = "pointer";
    topLogo.style.zIndex = "999999";
    container.appendChild(topLogo);

    // Hover image swap to ON version
    topLogo.addEventListener("mouseover", ()=> {
      topLogo.src="gayejyptispades_spadelogomenu_on.png";
    });
    topLogo.addEventListener("mouseout", ()=> {
      topLogo.src="gayejyptispades_spadelogomenu.png";
    });

    // Click refresh entire game
    topLogo.addEventListener("click", ()=> {
      location.reload();   // FULL GAME REFRESH
    });

    // ================= TOP GOLD TITLE TEXT =================
    const titleText = document.createElement("div");
    titleText.innerText = "";
    titleText.style.position = "absolute";
    titleText.style.top = "10px";
    titleText.style.left = "65px";
    titleText.style.fontSize = "18px";
    titleText.style.color = "gold";
    titleText.style.fontWeight = "bold";
    titleText.style.textShadow = "0 0 0px gold";
    titleText.style.zIndex = "999999";
    container.appendChild(titleText);


    const msg = document.createElement('div');
    msg.id = 'gameMessage';
    msg.style.position = 'absolute';
    msg.style.top = '12px';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.color = 'gold';
    msg.style.fontSize = '16px';
    msg.style.zIndex = 600000;
    container.appendChild(msg);

    function setMessage(text, timeout) {
      msg.textContent = text || '';
      if (timeout)
        setTimeout(() => {
          if (msg.textContent === text) msg.textContent = '';
        }, timeout);
    }

    // Reel wrapper
    const reelWrap = document.createElement('div');
    reelWrap.id = 'reelWrap';
    reelWrap.style.position = 'absolute';
    reelWrap.style.left = '0';
    reelWrap.style.right = '0';
    reelWrap.style.top = REEL_TOP + 'px';
    reelWrap.style.height = BACK_CARD_HEIGHT + 'px';
    reelWrap.style.overflow = 'hidden';
    reelWrap.style.zIndex = 500000;
    reelWrap.style.pointerEvents = 'auto';
    container.appendChild(reelWrap);

    const styleTag = document.createElement('style');
    styleTag.textContent = `
      .reelTrack { display:flex; align-items:center; gap:${REEL_GAP}px; }
      .reelBack { width:${BACK_CARD_WIDTH}px; height:${BACK_CARD_HEIGHT}px; cursor:pointer; user-select:none; }
      @keyframes reelLoop { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .reelInnerAnimated { animation-timing-function: linear; animation-iteration-count: infinite; animation-name: reelLoop; }

      #foresightOverlay { display:none; }
      .foresightInner { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; padding-top:40px; }
      .foresightRowWrapper { display:flex; align-items:center; justify-content:center; gap:20px; }
      #foresightRow { display:flex; gap:12px; }

      #favoriteGamesOverlay { display:none; }
      .favoriteCenter { display:flex; flex-direction:column; gap:18px; align-items:center; justify-content:center; }
      .favoriteRow { display:flex; align-items:center; gap:20px; padding:8px 12px; border-radius:8px; }
      .favoriteHeart { width:30px; height:20px; }
      .favoriteCardsRow { display:flex; gap:8px; }
      .favoriteCardThumb { width:30px; height:45px; border-radius:4px; }

      .foresightCard { width:${SLOT_WIDTH}px; height:${SLOT_HEIGHT}px; }
    `;
    document.head.appendChild(styleTag);

    // Build reel
    const trackA = document.createElement('div'); trackA.className = 'reelTrack';
    const trackB = document.createElement('div'); trackB.className = 'reelTrack';

    for (let i = 0; i < TOTAL_CARDS; i++) {
      const im = document.createElement('img');
      im.src = CARD_IMAGES.back;
      im.className = 'reelBack';
      trackA.appendChild(im);
    }
    for (let i = 0; i < TOTAL_CARDS; i++) {
      const im = document.createElement('img');
      im.src = CARD_IMAGES.back;
      im.className = 'reelBack';
      trackB.appendChild(im);
    }

    const inner = document.createElement('div');
    inner.style.display = 'flex';
    inner.appendChild(trackA);
    inner.appendChild(trackB);
    inner.className = 'reelInnerAnimated';
    reelWrap.appendChild(inner);

    requestAnimationFrame(() => {
      const trackWidth = trackA.scrollWidth + REEL_GAP * 2;
      const speedPxPerSec = 60;
      const duration = Math.max(10, Math.round(trackWidth / speedPxPerSec));
      inner.style.animationDuration = duration + 's';
      inner.style.width = (trackA.scrollWidth + trackB.scrollWidth) + 'px';
    });

    // Slots
    const slotsContainer = document.createElement('div');
    slotsContainer.id = 'slotsContainer';
    slotsContainer.style.position = 'absolute';
    slotsContainer.style.left = '0';
    slotsContainer.style.right = '0';
    slotsContainer.style.bottom = '0';
    slotsContainer.style.height = (SLOT_HEIGHT + BOTTOM_OFFSET + 20) + 'px';
    slotsContainer.style.zIndex = 550000;
    container.appendChild(slotsContainer);

    for (let s = 1; s <= 8; s++) {
      const slotBox = document.createElement('div');
      slotBox.className = 'cardSlot';
      slotBox.dataset.slot = s;
      slotBox.style.position = 'absolute';
      slotBox.style.left = SLOT_LEFTS[s] + 'px';
      slotBox.style.bottom = BOTTOM_OFFSET + 'px';
      slotBox.style.width = SLOT_WIDTH + 'px';
      slotBox.style.height = SLOT_HEIGHT + 'px';
      slotBox.style.border = '2px dashed rgba(255,255,255,0.06)';
      slotBox.style.display = 'flex';
      slotBox.style.alignItems = 'center';
      slotBox.style.justifyContent = 'center';
      slotsContainer.appendChild(slotBox);
    }

    // Torches
    const leftTorch = document.createElement('img');
    leftTorch.id = 'leftTorch';
    leftTorch.src = CARD_IMAGES.torch;
    leftTorch.style.position = 'absolute';
    leftTorch.style.left = '2px';
    leftTorch.style.bottom = '75px';
    leftTorch.style.width = '64px';
    leftTorch.style.height = '64px';
    leftTorch.style.cursor = 'pointer';
    leftTorch.style.zIndex = 700000;
    container.appendChild(leftTorch);

    const rightTorch = document.createElement('img');
    rightTorch.id = 'rightTorch';
    rightTorch.src = CARD_IMAGES.torch;
    rightTorch.style.position = 'absolute';
    rightTorch.style.left = '275px';
    rightTorch.style.bottom = '75px';
    rightTorch.style.width = '64px';
    rightTorch.style.height = '64px';
    rightTorch.style.cursor = 'pointer';
    rightTorch.style.zIndex = 700000;
    container.appendChild(rightTorch);

    // Foresight overlay
    const foresight = document.createElement('div');
    foresight.id = 'foresightOverlay';
    foresight.style.position = 'absolute';
    foresight.style.inset = '0';
    foresight.style.background = 'rgba(0,0,0,0.0)';
    foresight.style.display = 'none';
    foresight.style.zIndex = 800000;
    foresight.style.color = 'gold';
    foresight.style.alignItems = 'center';
    foresight.style.justifyContent = 'center';
    container.appendChild(foresight);

    const foresightInner = document.createElement('div');
    foresightInner.className = 'foresightInner';
    foresight.appendChild(foresightInner);

    const fTitle = document.createElement('div');
    fTitle.innerText = 'Foresight — Final 8 Cards';
    fTitle.style.fontSize = '18px';
    fTitle.style.marginBottom = '18px';
    foresightInner.appendChild(fTitle);

    const foresightRowWrapper = document.createElement('div');
    foresightRowWrapper.className = 'foresightRowWrapper';
    foresightInner.appendChild(foresightRowWrapper);

    const fHeart = document.createElement('img');
    fHeart.src = CARD_IMAGES.heart;
    fHeart.alt = 'heart';
    fHeart.style.width = '30px';
    fHeart.style.height = '20px';
    foresightRowWrapper.appendChild(fHeart);

    const fRow = document.createElement('div');
    fRow.id = 'foresightRow';
    foresightRowWrapper.appendChild(fRow);

    // Favorites overlay
    const favOverlay = document.createElement('div');
    favOverlay.id = 'favoriteGamesOverlay';
    favOverlay.style.position = 'absolute';
    favOverlay.style.inset = '0';
    favOverlay.style.background = 'rgba(0,0,0,0.0)';
    favOverlay.style.display = 'none';
    favOverlay.style.zIndex = '900000';
    favOverlay.style.color = 'gold';
    favOverlay.style.alignItems = 'center';
    favOverlay.style.justifyContent = 'center';
    container.appendChild(favOverlay);

    const favCenter = document.createElement('div');
    favCenter.className = 'favoriteCenter';
    favCenter.style.width = '100%';
    favCenter.style.maxWidth = '1200px';
    favOverlay.appendChild(favCenter);

    const favTitle = document.createElement('div');
    favTitle.innerText = 'Favorite Games — Last 5';
    favTitle.style.fontSize = '18px';
    favTitle.style.marginBottom = '12px';
    favCenter.appendChild(favTitle);

    const favList = document.createElement('div');
    favList.id = 'favoriteListRows';
    favList.style.display = 'flex';
    favList.style.flexDirection = 'column';
    favList.style.gap = '14px';
    favList.style.alignItems = 'center';
    favList.style.justifyContent = 'center';
    favCenter.appendChild(favList);

    // Reel click
    reelWrap.addEventListener('click', (ev) => {
      const clickTarget = ev.target;
      if (!clickTarget || !clickTarget.classList.contains('reelBack')) return;
      if (!reelsEnabled) return;
      if (drawsDone >= MAX_TOTAL_DRAWS) {
        setMessage('No more draws available.', 2000);
        return;
      }
      if (!deck.length) {
        setMessage('Deck empty.', 2000);
        return;
      }

      reelsEnabled = false;
      clickTarget.style.opacity = '0.35';
      clickTarget.style.pointerEvents = 'none';

      const type = deck.shift();
      drawsDone++;
      if (initialPicksDone < INITIAL_PICKS) initialPicksDone++;

      const reveal = document.createElement('img');
      reveal.src = CARD_IMAGES[type] || CARD_IMAGES.back;
      reveal.style.position = 'absolute';
      reveal.style.width = BACK_CARD_WIDTH + 'px';
      reveal.style.height = BACK_CARD_HEIGHT + 'px';

      const parentRect = container.getBoundingClientRect();
      reveal.style.left = (ev.clientX - parentRect.left - BACK_CARD_WIDTH / 2) + 'px';
      reveal.style.top = (ev.clientY - parentRect.top - BACK_CARD_HEIGHT / 2) + 'px';

      reveal.style.zIndex = 750000;
      reveal.style.transition = 'all 600ms cubic-bezier(.2,.9,.2,1)';
      reveal.dataset.type = type;
      reveal.dataset.cardId = nextCardId++;
      container.appendChild(reveal);

      const targetSlot = chooseSlotFor(type);
      const slotLeft = SLOT_LEFTS[targetSlot];
      const slotTop = container.clientHeight - SLOT_HEIGHT - BOTTOM_OFFSET;

      requestAnimationFrame(() => {
        reveal.style.width = SLOT_WIDTH + 'px';
        reveal.style.height = SLOT_HEIGHT + 'px';
        reveal.style.left = slotLeft + 'px';
        reveal.style.top = slotTop + 'px';
      });

      setTimeout(() => {
        const slotEl = container.querySelector(`.cardSlot[data-slot='${targetSlot}']`);
        if (!slotEl) {
          reveal.remove();
          reelsEnabled = true;
          return;
        }

        slotEl.innerHTML = '';
        reveal.style.position = 'relative';
        reveal.style.left = '0';
        reveal.style.top = '0';
        reveal.style.margin = '0';
        reveal.style.transition = 'none';
        reveal.style.cursor = 'pointer';
        slotEl.appendChild(reveal);

        slots[targetSlot] = { id: reveal.dataset.cardId, type, imgEl: reveal };
        reveal.addEventListener('click', (e) => { e.stopPropagation(); discardSlot(targetSlot); });

        reelsEnabled = true;
        setMessage(`Revealed ${type.toUpperCase()} (${drawsDone}/${MAX_TOTAL_DRAWS})`, 1600);
      }, 680);
    });

    // Left torch
    leftTorch.addEventListener('click', () => {
      if (!checkReadyForFinalize()) {
        setMessage('Need 8 cards including at least one spade to finalize.', 2600);
        return;
      }
      leftTorchLit = true;
      leftTorch.style.filter = 'drop-shadow(0 0 12px gold)';
      setMessage('Left torch lit — now click the right torch to finalize.', 2200);
    });

    // ------------------------------------------------------------
    // RIGHT TORCH — WITH THE NEW FADE-OUT + FADE-IN (HIDE reels & slots)
    // ------------------------------------------------------------
// ------------------------------------------------------------
// RIGHT TORCH — WITH FULL GAMEPLAY FADE-OUT INCLUDING TORCHES
// ------------------------------------------------------------
rightTorch.addEventListener('click', () => {
  if (!leftTorchLit) {
    setMessage('Click the left torch first.', 1600);
    return;
  }
  if (!checkReadyForFinalize()) {
    setMessage('Finalization requirements not met.', 2000);
    return;
  }

  // Fade out EVERYTHING related to gameplay so nothing shows beneath overlays.
  try {
    reelWrap.style.transition = 'opacity 600ms ease';
    slotsContainer.style.transition = 'opacity 600ms ease';
    leftTorch.style.transition = 'opacity 600ms ease';
    rightTorch.style.transition = 'opacity 600ms ease';

    reelWrap.style.opacity = '0';
    slotsContainer.style.opacity = '0';
    leftTorch.style.opacity = '0';
    rightTorch.style.opacity = '0';

    // disable pointer events after fade
    reelWrap.style.pointerEvents = 'none';
    slotsContainer.style.pointerEvents = 'none';
    leftTorch.style.pointerEvents = 'none';
    rightTorch.style.pointerEvents = 'none';
  } catch (e) {}

  // After fade completes, fade in foresight overlay
  setTimeout(() => {
    const foresightEl = container.querySelector('#foresightOverlay');
    if (foresightEl) {
      foresightEl.style.display = 'flex';
      foresightEl.style.opacity = '0';
      foresightEl.style.transition = 'opacity 600ms ease';
      requestAnimationFrame(() => {
        foresightEl.style.opacity = '1';
      });
    }

    finalize(container);

  }, 650);
});


    setMessage('Game ready — click any moving back card to reveal.', 6000);
    renderFavoriteOverlay(container);
  }

  function initGame(container) {
    deck = buildDeck();
    drawsDone = 0;
    initialPicksDone = 0;
    slots = Array(9).fill(null);
    nextCardId = 1;
    leftTorchLit = false;
    reelsEnabled = true;
    gameContentEl = container;

    const existingForesight = container.querySelector('#foresightOverlay');
    if (existingForesight) {
      existingForesight.style.display = 'none';
      const row = existingForesight.querySelector('#foresightRow');
      if (row) row.innerHTML = '';
    }

    const existingFav = container.querySelector('#favoriteGamesOverlay');
    if (existingFav) {
      existingFav.style.display = 'none';
      const col = existingFav.querySelector('#favoriteListRows');
      if (col) col.innerHTML = '';
    }

    createUI(container);
  }

  window.initGame = initGame;
})();
