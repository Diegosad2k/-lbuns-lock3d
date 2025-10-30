// script.js - versão atualizada
// Alteração principal: usa class "card" (compatível com style.css) em vez de "album-card"
// Funcionalidades: gerenciamento localStorage, render, editor/modal, export JSON, conversão de link Drive

(() => {
  const STORAGE_KEY = 'lock3d_albums_v1';

  // DOM
  const gallery = document.getElementById('gallery');
  const thumbnails = document.getElementById('thumbnails');
  const editor = document.getElementById('editor');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');

  const btnOpenEditor = document.getElementById('btn-open-editor');
  const btnDownloadJson = document.getElementById('btn-download-json');
  const btnAddLocal = document.getElementById('btn-add-local-assets');

  const form = document.getElementById('album-form');
  const inputIndex = document.getElementById('album-index');
  const inputs = {
    title: document.getElementById('title'),
    artist: document.getElementById('artist'),
    rhythm: document.getElementById('rhythm'),
    rating: document.getElementById('rating'),
    cover_url: document.getElementById('cover_url'),
    preview_audio_url: document.getElementById('preview_audio_url'),
    spotify_link: document.getElementById('spotify_link'),
    youtube_link: document.getElementById('youtube_link'),
    analysis: document.getElementById('analysis'),
  };
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const btnDelete = document.getElementById('btn-delete');
  const modalCloseBtn = document.getElementById('modal-close');

  let albums = loadAlbums();
  let lastDownloadedUrl = null;
  let lastFocusedBeforeDialog = null;
  let currentTrapHandler = null;

  function loadAlbums() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Erro ao ler localStorage', e);
      return [];
    }
  }

  function saveAlbums() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(albums, null, 2));
    render();
    prepareDownloadHref();
  }

  function render() {
    gallery.innerHTML = '';
    thumbnails.innerHTML = '';

    albums.forEach((a, i) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <button class="cover-btn" data-index="${i}" aria-label="Abrir ${escapeHtml(a.title || 'Álbum')}">
          <div class="cover"><img src="${escapeAttr(ensureImageUrl(a.cover_url))}" alt="${escapeAttr(a.title || 'Capa do álbum')}" /></div>
        </button>
        <div class="meta">
          <h4>${escapeHtml(a.title || '')}</h4>
          <p class="artist">${escapeHtml(a.artist || '')}</p>
        </div>
        <div class="actions">
          <button class="edit-btn" data-index="${i}" aria-label="Editar ${escapeHtml(a.title || '')}">Editar</button>
        </div>
      `;
      gallery.appendChild(card);

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.innerHTML = `<button data-index="${i}" class="thumb-btn" aria-label="Visualizar ${escapeHtml(a.title || '')}">${escapeHtml(a.title || '')}</button>`;
      thumbnails.appendChild(thumb);
    });

    // Delegation: attach handlers
    gallery.querySelectorAll('.cover-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        openModal(idx);
      });
    });
    gallery.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        openEditor(idx);
      });
    });
    thumbnails.querySelectorAll('.thumb-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        const el = gallery.querySelector(`.cover-btn[data-index="${idx}"]`);
        if (el) el.focus();
      });
    });
  }

  function openEditor(index) {
    lastFocusedBeforeDialog = document.activeElement;
    if (typeof index === 'number' && index >= 0) {
      const a = albums[index] || {};
      inputIndex.value = index;
      inputs.title.value = a.title || '';
      inputs.artist.value = a.artist || '';
      inputs.rhythm.value = a.rhythm || '';
      inputs.rating.value = a.rating || '';
      inputs.cover_url.value = a.cover_url || '';
      inputs.preview_audio_url.value = a.preview_audio_url || '';
      inputs.spotify_link.value = a.spotify_link || '';
      inputs.youtube_link.value = a.youtube_link || '';
      inputs.analysis.value = a.analysis || '';
    } else {
      inputIndex.value = '';
      form.reset();
    }
    setDialogVisibility(editor, true);
    inputs.title.focus();
  }

  function closeEditor() {
    setDialogVisibility(editor, false);
    if (lastFocusedBeforeDialog) lastFocusedBeforeDialog.focus();
  }

  function openModal(index) {
    lastFocusedBeforeDialog = document.activeElement;
    const a = albums[index] || {};
    modalBody.innerHTML = `
      <div class="modal-album">
        <img src="${escapeAttr(ensureImageUrl(a.cover_url))}" alt="${escapeAttr(a.title || 'Capa')}" />
        <h3>${escapeHtml(a.title || '')}</h3>
        <p class="artist">${escapeHtml(a.artist || '')}</p>
        <p class="analysis">${escapeHtml(a.analysis || '')}</p>
        ${a.preview_audio_url ? `<audio controls src="${escapeAttr(a.preview_audio_url)}"></audio>` : ''}
        ${a.spotify_link ? `<p><a href="${escapeAttr(a.spotify_link)}" target="_blank" rel="noopener noreferrer">Abrir no Spotify</a></p>` : ''}
        ${a.youtube_link ? `<p><a href="${escapeAttr(a.youtube_link)}" target="_blank" rel="noopener noreferrer">Ver no YouTube</a></p>` : ''}
      </div>
    `;
    setDialogVisibility(modal, true);
    if (modalCloseBtn) modalCloseBtn.focus();
  }

  function closeModal() {
    setDialogVisibility(modal, false);
    modalBody.innerHTML = '';
    if (lastFocusedBeforeDialog) lastFocusedBeforeDialog.focus();
  }

  function setDialogVisibility(el, visible) {
    if (visible) {
      el.classList.remove('hidden');
      el.setAttribute('aria-hidden', 'false');
      if (el === editor) btnOpenEditor.setAttribute('aria-expanded', 'true');
      trapFocus(el);
    } else {
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      if (el === editor) btnOpenEditor.setAttribute('aria-expanded', 'false');
      releaseFocusTrap();
    }
  }

  // Focus trap
  function trapFocus(container) {
    releaseFocusTrap();
    const focusables = Array.from(container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    currentTrapHandler = function(e) {
      if (e.key === 'Tab') {
        if (!first || !last) return;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      } else if (e.key === 'Escape') {
        if (!container.classList.contains('hidden')) {
          if (container === modal) closeModal();
          if (container === editor) closeEditor();
        }
      }
    };
    document.addEventListener('keydown', currentTrapHandler);
  }

  function releaseFocusTrap() {
    if (currentTrapHandler) {
      document.removeEventListener('keydown', currentTrapHandler);
      currentTrapHandler = null;
    }
  }

  // Utils
  function ensureImageUrl(url) {
    if (!url) return 'https://via.placeholder.com/400x400.png?text=Cover';
    return convertDriveUrl(url);
  }

  function convertDriveUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('drive.google.com')) {
        const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
        if (u.searchParams.has('id')) return `https://drive.google.com/uc?export=view&id=${u.searchParams.get('id')}`;
      }
    } catch (e) {
      // not a valid URL
    }
    return url;
  }

  function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function escapeAttr(s) {
    if (!s && s !== 0) return '';
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Form handlers
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const idx = inputIndex.value !== '' ? Number(inputIndex.value) : -1;
    const data = {
      title: inputs.title.value.trim(),
      artist: inputs.artist.value.trim(),
      rhythm: inputs.rhythm.value.trim(),
      rating: inputs.rating.value,
      cover_url: inputs.cover_url.value.trim(),
      preview_audio_url: inputs.preview_audio_url.value.trim(),
      spotify_link: inputs.spotify_link.value.trim(),
      youtube_link: inputs.youtube_link.value.trim(),
      analysis: inputs.analysis.value.trim(),
    };
    if (idx >= 0 && idx < albums.length) {
      albums[idx] = data;
    } else {
      albums.push(data);
    }
    saveAlbums();
    closeEditor();
  });

  btnCancelEdit.addEventListener('click', closeEditor);

  btnDelete.addEventListener('click', () => {
    const idx = inputIndex.value !== '' ? Number(inputIndex.value) : -1;
    if (idx >= 0 && idx < albums.length) {
      if (confirm('Excluir este álbum?')) {
        albums.splice(idx, 1);
        saveAlbums();
        closeEditor();
      }
    }
  });

  // Buttons / events
  btnOpenEditor.addEventListener('click', () => openEditor());
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  btnAddLocal.addEventListener('click', () => {
    albums.push({
      title: 'Exemplo',
      artist: 'Artista Exemplo',
      rhythm: 'Eletrônico',
      rating: 4.5,
      cover_url: 'https://via.placeholder.com/400x400.png?text=Cover',
      preview_audio_url: '',
      spotify_link: '',
      youtube_link: '',
      analysis: 'Análise de exemplo.',
    });
    saveAlbums();
  });

  // Download/export
  function prepareDownloadHref() {
    if (lastDownloadedUrl) {
      URL.revokeObjectURL(lastDownloadedUrl);
      lastDownloadedUrl = null;
    }
    const blob = new Blob([JSON.stringify(albums, null, 2)], { type: 'application/json' });
    lastDownloadedUrl = URL.createObjectURL(blob);
    btnDownloadJson.href = lastDownloadedUrl;
  }
  btnDownloadJson.addEventListener('click', () => {
    setTimeout(() => {
      if (lastDownloadedUrl) {
        URL.revokeObjectURL(lastDownloadedUrl);
        lastDownloadedUrl = null;
        btnDownloadJson.href = '#';
      }
    }, 1000);
  });

  // Inicialização
  render();
  prepareDownloadHref();
})();