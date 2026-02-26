// ==========================================
// מדרג הישובים - לוגיקת האפליקציה
// ==========================================

class YishuvRanker {
  constructor() {
    this.screens = {};
    this.currentScreen = 'home';
    this.leaderboard = {
      sortBy: 'population', sortDir: 'desc',
      district: 'הכל', type: 'הכל', search: '',
      filters: {},
    };
    this.filtersOpen = false;
    this.selectMode = false;
    this.selectedCodes = new Set();
    this.favorites = new Set(JSON.parse(localStorage.getItem('yishuv_favorites') || '[]'));
    this.dataReady = false;
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', async () => {
      this.cacheElements();
      this.bindEvents();
      this.showScreen('home');
      await this.loadDataFromAPI();
    });
  }

  async loadDataFromAPI() {
    const heroSub = document.getElementById('hero-subtitle');
    const loadingBar = document.getElementById('loading-bar');
    try {
      if (loadingBar) loadingBar.classList.add('active');
      if (heroSub) heroSub.textContent = 'טוען נתונים מ-3 מקורות...';
      await loadData();
      this.dataReady = true;
      const withWage = YISHUVIM.filter(y => y.medianWage).length;
      const withSocio = YISHUVIM.filter(y => y.socioCluster).length;
      if (heroSub) heroSub.innerHTML =
        `נטענו <strong>${YISHUVIM.length.toLocaleString('he-IL')}</strong> יישובים` +
        ` · ${withWage} עם נתוני שכר` +
        ` · ${withSocio} עם מדד חברתי-כלכלי`;
      if (loadingBar) loadingBar.classList.remove('active');
      this.enableButtons(true);
      this.updateFavBadge();
    } catch (err) {
      console.error(err);
      if (heroSub) heroSub.textContent = 'שגיאה בטעינת נתונים. בדקו חיבור אינטרנט ונסו לרענן.';
      if (loadingBar) loadingBar.classList.remove('active');
      this.enableButtons(false);
    }
  }

  enableButtons(enabled) {
    ['btn-leaderboard-mode', 'btn-favorites-mode'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.style.opacity = enabled ? '1' : '0.5';
        btn.style.pointerEvents = enabled ? 'auto' : 'none';
      }
    });
  }

  cacheElements() {
    this.screens = {
      home: document.getElementById('screen-home'),
      leaderboard: document.getElementById('screen-leaderboard'),
      favorites: document.getElementById('screen-favorites'),
    };
    this.headerTitle = document.getElementById('header-title-text');
    this.headerBack = document.getElementById('header-back');
  }

  bindEvents() {
    this.headerBack.addEventListener('click', () => this.goBack());

    document.getElementById('btn-leaderboard-mode').addEventListener('click', () => {
      if (!this.dataReady) return;
      this.renderLeaderboard();
      this.showScreen('leaderboard');
    });

    document.getElementById('btn-favorites-mode').addEventListener('click', () => {
      if (!this.dataReady) return;
      this.renderFavorites();
      this.showScreen('favorites');
    });

    document.getElementById('lb-search').addEventListener('input', (e) => {
      this.leaderboard.search = e.target.value;
      this.renderLeaderboardList();
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
    document.getElementById('modal-close-btn').addEventListener('click', () => this.closeModal());

    // Toggle filters panel
    document.getElementById('toggle-filters-btn').addEventListener('click', () => {
      this.filtersOpen = !this.filtersOpen;
      document.getElementById('filters-panel').classList.toggle('open', this.filtersOpen);
      document.getElementById('toggle-filters-btn').classList.toggle('active', this.filtersOpen);
    });

    // Clear filters
    document.getElementById('clear-filters-btn').addEventListener('click', () => {
      this.leaderboard.filters = {};
      this.renderFilterControls();
      this.renderLeaderboardList();
      this.updateActiveFilterCount();
    });

    // Export selection mode
    document.getElementById('toggle-select-btn').addEventListener('click', () => {
      this.selectMode = !this.selectMode;
      document.getElementById('toggle-select-btn').classList.toggle('active', this.selectMode);
      document.getElementById('export-bar').classList.toggle('visible', this.selectMode);
      if (!this.selectMode) { this.selectedCodes.clear(); this.updateExportBar(); }
      this.renderLeaderboardList();
    });

    document.getElementById('export-csv-btn').addEventListener('click', () => this.exportCSV());
    document.getElementById('select-all-btn').addEventListener('click', () => this.selectAllVisible());
    document.getElementById('clear-selection-btn').addEventListener('click', () => {
      this.selectedCodes.clear();
      this.updateExportBar();
      this.renderLeaderboardList();
    });
  }

  // ==========================================
  // Navigation
  // ==========================================
  showScreen(name) {
    Object.values(this.screens).forEach(s => { if (s) s.classList.remove('active'); });
    if (this.screens[name]) this.screens[name].classList.add('active');
    this.currentScreen = name;

    const titles = {
      home: '🏘️ מדרג הישובים',
      leaderboard: '📊 טבלת ישובים',
      favorites: '⭐ מועדפים',
    };
    this.headerTitle.textContent = titles[name] || '';
    this.headerBack.classList.toggle('hidden', name === 'home');
    window.scrollTo(0, 0);
  }

  goBack() {
    this.showScreen('home');
  }

  // ==========================================
  // Favorites
  // ==========================================
  saveFavorites() {
    localStorage.setItem('yishuv_favorites', JSON.stringify([...this.favorites]));
    this.updateFavBadge();
  }

  toggleFavorite(code) {
    if (this.favorites.has(code)) this.favorites.delete(code);
    else this.favorites.add(code);
    this.saveFavorites();
  }

  isFavorite(code) {
    return this.favorites.has(code);
  }

  updateFavBadge() {
    const badge = document.getElementById('fav-count-badge');
    if (badge) {
      badge.textContent = this.favorites.size;
      badge.style.display = this.favorites.size > 0 ? 'inline-flex' : 'none';
    }
  }

  renderFavorites() {
    const container = document.getElementById('favorites-list');
    const favItems = YISHUVIM.filter(y => this.favorites.has(y.code));

    if (favItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⭐</div>
          <p>אין מועדפים עדיין</p>
          <p style="font-size:0.85rem;color:var(--text-muted)">לחצו על הכוכב ליד שם הישוב בטבלה או בכרטיס הפרטים</p>
        </div>
      `;
      return;
    }

    const countEl = document.getElementById('fav-result-count');
    if (countEl) countEl.textContent = `${favItems.length} מועדפים`;

    container.innerHTML = favItems.map((item) => {
      const origIndex = YISHUVIM.indexOf(item);
      const extraInfo = [];
      if (item.socioCluster) extraInfo.push(`📊 ${item.socioCluster}/10`);
      if (item.medianWage) extraInfo.push(`💰 ₪${this.formatNumber(item.medianWage)}`);

      return `
        <div class="leaderboard-item fav-item">
          <button class="fav-star active" onclick="event.stopPropagation(); app.removeFavoriteAndRefresh('${item.code}')" title="הסר ממועדפים">★</button>
          <div class="lb-info" onclick="app.showDetail(${origIndex})">
            <div class="lb-name">${item.name}</div>
            <div class="lb-meta">
              <span>${item.district}</span><span>·</span><span>${item.type}</span>
              <span>·</span><span>👥 ${this.formatNumber(item.population)}</span>
              ${extraInfo.length ? '<span>·</span><span>' + extraInfo.join(' ') + '</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Export all favorites button
    container.innerHTML += `
      <button class="export-favs-btn" onclick="app.exportFavoritesCSV()">
        📥 ייצוא ${favItems.length} מועדפים ל-Excel
      </button>
    `;
  }

  removeFavoriteAndRefresh(code) {
    this.favorites.delete(code);
    this.saveFavorites();
    this.renderFavorites();
  }

  exportFavoritesCSV() {
    const prev = this.selectedCodes;
    this.selectedCodes = new Set([...this.favorites]);
    this.exportCSV();
    this.selectedCodes = prev;
  }

  // ==========================================
  // Leaderboard
  // ==========================================
  renderLeaderboard() {
    this.renderLeaderboardFilters();
    this.renderSortButtons();
    this.renderFilterControls();
    this.updateSortButtons();
    this.renderLeaderboardList();
  }

  renderLeaderboardFilters() {
    const distContainer = document.getElementById('lb-districts');
    distContainer.innerHTML = DISTRICTS.map(d =>
      `<span class="filter-chip ${d === this.leaderboard.district ? 'active' : ''}" data-value="${d}">${d}</span>`
    ).join('');
    distContainer.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        distContainer.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.leaderboard.district = chip.dataset.value;
        this.renderLeaderboardList();
      });
    });

    const typeContainer = document.getElementById('lb-types');
    if (typeContainer) {
      typeContainer.innerHTML = TYPES.map(t =>
        `<span class="filter-chip ${t === this.leaderboard.type ? 'active' : ''}" data-value="${t}">${t}</span>`
      ).join('');
      typeContainer.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          typeContainer.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.leaderboard.type = chip.dataset.value;
          this.renderLeaderboardList();
        });
      });
    }
  }

  renderSortButtons() {
    const sortRow = document.getElementById('lb-sort-row');
    if (!sortRow) return;
    sortRow.innerHTML = RANKING_CATEGORIES.map(cat => `
      <button class="sort-btn ${cat.id === this.leaderboard.sortBy ? 'active' : ''}" data-sort="${cat.id}">
        ${cat.icon} ${cat.label} <span class="arrow"></span>
      </button>
    `).join('');
    sortRow.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sortBy = btn.dataset.sort;
        if (this.leaderboard.sortBy === sortBy) {
          this.leaderboard.sortDir = this.leaderboard.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
          this.leaderboard.sortBy = sortBy;
          this.leaderboard.sortDir = 'desc';
        }
        this.updateSortButtons();
        this.renderLeaderboardList();
      });
    });
  }

  updateSortButtons() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
      const isActive = btn.dataset.sort === this.leaderboard.sortBy;
      btn.classList.toggle('active', isActive);
      const arrow = btn.querySelector('.arrow');
      if (arrow) arrow.textContent = isActive ? (this.leaderboard.sortDir === 'desc' ? '▼' : '▲') : '';
    });
  }

  // ==========================================
  // Advanced Filters
  // ==========================================
  renderFilterControls() {
    const panel = document.getElementById('filters-content');
    if (!panel) return;

    panel.innerHTML = FILTER_FIELDS.map(field => {
      const currentFilter = this.leaderboard.filters[field.id] || {};

      if (field.type === 'range') {
        const minVal = currentFilter.min !== undefined ? currentFilter.min : field.min;
        const maxVal = currentFilter.max !== undefined ? currentFilter.max : field.max;
        return `
          <div class="filter-control" data-field="${field.id}">
            <div class="filter-control-header">
              <span>${field.icon} ${field.label}</span>
              <span class="filter-range-label" id="range-label-${field.id}">${this.formatFilterVal(minVal, field)} - ${this.formatFilterVal(maxVal, field)}</span>
            </div>
            <div class="dual-range">
              <input type="range" class="range-min" min="${field.min}" max="${field.max}" step="${field.step}" value="${minVal}"
                data-field="${field.id}" oninput="app.onFilterRangeChange('${field.id}')">
              <input type="range" class="range-max" min="${field.min}" max="${field.max}" step="${field.step}" value="${maxVal}"
                data-field="${field.id}" oninput="app.onFilterRangeChange('${field.id}')">
            </div>
          </div>
        `;
      } else if (field.type === 'select') {
        const selVal = currentFilter.value || 'הכל';
        return `
          <div class="filter-control" data-field="${field.id}">
            <div class="filter-control-header">
              <span>${field.icon} ${field.label}</span>
            </div>
            <div class="filter-select-row">
              ${field.options.map(opt => `
                <span class="filter-chip ${selVal === opt ? 'active' : ''}"
                  onclick="app.onFilterSelectChange('${field.id}', '${opt}')">${opt}</span>
              `).join('')}
            </div>
          </div>
        `;
      }
      return '';
    }).join('');
  }

  formatFilterVal(val, field) {
    if (field.format === 'pct') return val + '%';
    if (val >= 1000) return (val / 1000).toFixed(val >= 10000 ? 0 : 1) + 'K';
    return val;
  }

  onFilterRangeChange(fieldId) {
    const field = FILTER_FIELDS.find(f => f.id === fieldId);
    const container = document.querySelector(`.filter-control[data-field="${fieldId}"]`);
    const minInput = container.querySelector('.range-min');
    const maxInput = container.querySelector('.range-max');
    let minVal = parseFloat(minInput.value);
    let maxVal = parseFloat(maxInput.value);

    if (minVal > maxVal) { const tmp = minVal; minVal = maxVal; maxVal = tmp; minInput.value = minVal; maxInput.value = maxVal; }

    const label = document.getElementById(`range-label-${fieldId}`);
    if (label) label.textContent = `${this.formatFilterVal(minVal, field)} - ${this.formatFilterVal(maxVal, field)}`;

    if (minVal <= field.min && maxVal >= field.max) {
      delete this.leaderboard.filters[fieldId];
    } else {
      this.leaderboard.filters[fieldId] = { min: minVal, max: maxVal };
    }
    this.updateActiveFilterCount();
    this.renderLeaderboardList();
  }

  onFilterSelectChange(fieldId, value) {
    if (value === 'הכל') {
      delete this.leaderboard.filters[fieldId];
    } else {
      this.leaderboard.filters[fieldId] = { value };
    }
    this.renderFilterControls();
    this.updateActiveFilterCount();
    this.renderLeaderboardList();
  }

  updateActiveFilterCount() {
    const count = Object.keys(this.leaderboard.filters).length;
    const badge = document.getElementById('filter-count-badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  applyFilters(items) {
    const filters = this.leaderboard.filters;
    return items.filter(item => {
      for (const [fieldId, filter] of Object.entries(filters)) {
        const val = item[fieldId];
        if (filter.min !== undefined && filter.max !== undefined) {
          if (val === null || val === undefined) return false;
          if (val < filter.min || val > filter.max) return false;
        }
        if (filter.value !== undefined) {
          if (val === null || val === undefined) return false;
          if (!String(val).includes(filter.value)) return false;
        }
      }
      return true;
    });
  }

  renderLeaderboardList() {
    let items = [...YISHUVIM];
    if (this.leaderboard.district !== 'הכל') items = items.filter(y => y.district === this.leaderboard.district);
    if (this.leaderboard.type !== 'הכל') items = items.filter(y => y.type === this.leaderboard.type);
    if (this.leaderboard.search) items = items.filter(y => y.name.includes(this.leaderboard.search));
    items = this.applyFilters(items);

    const sortKey = this.leaderboard.sortBy;
    const dir = this.leaderboard.sortDir === 'desc' ? -1 : 1;
    items.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (va === null || va === undefined) va = -Infinity;
      if (vb === null || vb === undefined) vb = -Infinity;
      if (typeof va === 'string') return dir * va.localeCompare(vb, 'he');
      return dir * (va - vb);
    });

    const container = document.getElementById('lb-list');
    const countEl = document.getElementById('lb-result-count');
    if (countEl) countEl.textContent = `${items.length} יישובים`;

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>לא נמצאו ישובים</p></div>`;
      return;
    }

    const cat = RANKING_CATEGORIES.find(c => c.key === sortKey);
    const unit = cat ? cat.unit : '';

    container.innerHTML = items.slice(0, 200).map((item, i) => {
      let displayValue = item[sortKey];
      if (displayValue === null || displayValue === undefined) displayValue = '—';
      else if (typeof displayValue === 'number') {
        if (sortKey === 'medianWage') displayValue = '₪' + this.formatNumber(displayValue);
        else displayValue = this.formatNumber(displayValue);
      }
      const origIndex = YISHUVIM.indexOf(item);
      const extraInfo = [];
      if (sortKey !== 'population') extraInfo.push(`👥 ${this.formatNumber(item.population)}`);
      if (sortKey !== 'socioCluster' && item.socioCluster) extraInfo.push(`📊 ${item.socioCluster}`);

      const isSelected = this.selectedCodes.has(item.code);
      const checkbox = this.selectMode
        ? `<div class="lb-checkbox ${isSelected ? 'checked' : ''}" onclick="event.stopPropagation(); app.toggleSelect('${item.code}')"></div>`
        : '';

      const isFav = this.isFavorite(item.code);
      const favBtn = `<button class="fav-star ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); app.toggleFavFromList('${item.code}')" title="${isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}">${isFav ? '★' : '☆'}</button>`;

      return `
        <div class="leaderboard-item ${isSelected ? 'selected' : ''}" onclick="app.showDetail(${origIndex})">
          ${checkbox}
          ${favBtn}
          <div class="lb-rank">${i + 1}</div>
          <div class="lb-info">
            <div class="lb-name">${item.name}</div>
            <div class="lb-meta">
              <span>${item.district}</span><span>·</span><span>${item.type}</span>
              ${extraInfo.length ? '<span>·</span><span>' + extraInfo.join(' ') + '</span>' : ''}
            </div>
          </div>
          <div class="lb-value">${displayValue} ${unit}</div>
        </div>
      `;
    }).join('');

    if (items.length > 200) {
      container.innerHTML += `<div class="lb-more">מוצגים 200 מתוך ${items.length} תוצאות</div>`;
    }
  }

  toggleFavFromList(code) {
    this.toggleFavorite(code);
    this.renderLeaderboardList();
  }

  // ==========================================
  // Detail Modal
  // ==========================================
  showDetail(index) {
    if (index < 0 || index >= YISHUVIM.length) return;
    const item = YISHUVIM[index];
    this._modalItemCode = item.code;

    document.getElementById('modal-title').textContent = item.name;
    document.getElementById('modal-subtitle').textContent = `${item.district} · ${item.type}`;

    // Favorite button in modal
    const isFav = this.isFavorite(item.code);
    document.getElementById('modal-fav-btn').className = `modal-fav-btn ${isFav ? 'active' : ''}`;
    document.getElementById('modal-fav-btn').innerHTML = `${isFav ? '★ במועדפים' : '☆ הוסף למועדפים'}`;

    const stats = [
      { icon: '👥', val: this.formatNumber(item.population), lbl: 'אוכלוסייה' },
      { icon: '📊', val: item.socioCluster ? item.socioCluster + '/10' : '—', lbl: 'אשכול חברתי-כלכלי' },
      { icon: '🛐', val: item.religion || '—', lbl: 'דת עיקרית' },
      { icon: '📅', val: item.medianAge || '—', lbl: 'גיל חציוני' },
      { icon: '🏘️', val: item.density ? this.formatNumber(Math.round(item.density)) : '—', lbl: 'צפיפות לקמ״ר' },
      { icon: '💰', val: item.medianWage ? '₪' + this.formatNumber(item.medianWage) : '—', lbl: 'שכר חציוני שנתי' },
      { icon: '🎓', val: item.academicPct ? item.academicPct + '%' : '—', lbl: '% אקדמאים' },
      { icon: '💼', val: item.employmentPct ? item.employmentPct + '%' : '—', lbl: '% מועסקים' },
      { icon: '🏠', val: item.avgHouseholdSize || '—', lbl: 'גודל משק בית' },
      { icon: '👶', val: item.avgChildrenBorn || '—', lbl: 'ילדים (ממוצע)' },
      { icon: '💍', val: item.medianMarriageAge || '—', lbl: 'גיל נישואין חציוני' },
      { icon: '🔑', val: item.ownPct ? item.ownPct + '%' : '—', lbl: '% בעלי דירה' },
      { icon: '👶', val: this.formatNumber(item.age0_5 + item.age6_18), lbl: 'צעירים (0-18)' },
      { icon: '🧑', val: this.formatNumber(item.age19_45), lbl: 'בוגרים (19-45)' },
      { icon: '👴', val: this.formatNumber(item.age65plus), lbl: 'קשישים (65+)' },
      { icon: '📍', val: item.napa, lbl: 'נפה' },
    ];
    if (item.council) stats.push({ icon: '🏛️', val: item.council, lbl: 'מועצה אזורית' });

    document.getElementById('modal-stats-grid').innerHTML = stats.map(s => `
      <div class="modal-stat">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-val">${s.val}</div>
        <div class="stat-lbl">${s.lbl}</div>
      </div>
    `).join('');

    document.getElementById('modal-overlay').classList.add('active');
  }

  toggleModalFavorite() {
    if (!this._modalItemCode) return;
    this.toggleFavorite(this._modalItemCode);
    const isFav = this.isFavorite(this._modalItemCode);
    document.getElementById('modal-fav-btn').className = `modal-fav-btn ${isFav ? 'active' : ''}`;
    document.getElementById('modal-fav-btn').innerHTML = `${isFav ? '★ במועדפים' : '☆ הוסף למועדפים'}`;
    // Refresh list behind modal if visible
    if (this.currentScreen === 'leaderboard') this.renderLeaderboardList();
    if (this.currentScreen === 'favorites') this.renderFavorites();
  }

  closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }

  // ==========================================
  // Export to CSV
  // ==========================================
  toggleSelect(code) {
    if (this.selectedCodes.has(code)) this.selectedCodes.delete(code);
    else this.selectedCodes.add(code);
    this.updateExportBar();
    this.renderLeaderboardList();
  }

  selectAllVisible() {
    let items = [...YISHUVIM];
    if (this.leaderboard.district !== 'הכל') items = items.filter(y => y.district === this.leaderboard.district);
    if (this.leaderboard.type !== 'הכל') items = items.filter(y => y.type === this.leaderboard.type);
    if (this.leaderboard.search) items = items.filter(y => y.name.includes(this.leaderboard.search));
    items = this.applyFilters(items);
    items.forEach(item => this.selectedCodes.add(item.code));
    this.updateExportBar();
    this.renderLeaderboardList();
  }

  updateExportBar() {
    const count = this.selectedCodes.size;
    const countEl = document.getElementById('export-count');
    const btn = document.getElementById('export-csv-btn');
    if (countEl) countEl.textContent = count;
    if (btn) btn.disabled = count === 0;
  }

  exportCSV() {
    const selected = YISHUVIM.filter(y => this.selectedCodes.has(y.code));
    if (selected.length === 0) return;

    const columns = [
      { key: 'name', header: 'שם ישוב' },
      { key: 'code', header: 'סמל ישוב' },
      { key: 'district', header: 'מחוז' },
      { key: 'napa', header: 'נפה' },
      { key: 'type', header: 'סוג' },
      { key: 'council', header: 'מועצה אזורית' },
      { key: 'population', header: 'אוכלוסייה' },
      { key: 'youthPercent', header: '% צעירים (0-18)' },
      { key: 'elderPercent', header: '% קשישים (65+)' },
      { key: 'age0_5', header: 'גיל 0-5' },
      { key: 'age6_18', header: 'גיל 6-18' },
      { key: 'age19_45', header: 'גיל 19-45' },
      { key: 'age46_55', header: 'גיל 46-55' },
      { key: 'age56_64', header: 'גיל 56-64' },
      { key: 'age65plus', header: 'גיל 65+' },
      { key: 'density', header: 'צפיפות לקמ״ר' },
      { key: 'medianAge', header: 'גיל חציוני' },
      { key: 'medianWage', header: 'שכר חציוני שנתי' },
      { key: 'academicPct', header: '% אקדמאים' },
      { key: 'employmentPct', header: '% מועסקים' },
      { key: 'avgHouseholdSize', header: 'גודל משק בית' },
      { key: 'religion', header: 'דת עיקרית' },
      { key: 'sexRatio', header: 'יחס מינים' },
      { key: 'avgChildrenBorn', header: 'ילדים שנולדו (ממוצע)' },
      { key: 'medianMarriageAge', header: 'גיל נישואין חציוני' },
      { key: 'workParticipation', header: '% השתתפות בעבודה' },
      { key: 'ownPct', header: '% בעלי דירה' },
      { key: 'rentPct', header: '% שוכרים' },
      { key: 'socioCluster', header: 'אשכול חברתי-כלכלי' },
    ];

    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const header = columns.map(c => esc(c.header)).join(',');
    const rows = selected.map(item =>
      columns.map(c => esc(item[c.key])).join(',')
    );
    const csv = '\uFEFF' + header + '\n' + rows.join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ישובים_${selected.length}_נבחרים.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // Utilities
  // ==========================================
  formatNumber(num) { return (num || 0).toLocaleString('he-IL'); }
}

const app = new YishuvRanker();
