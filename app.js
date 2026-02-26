// ==========================================
// מדרג הישובים - לוגיקת האפליקציה
// ==========================================

class YishuvRanker {
  constructor() {
    this.screens = {};
    this.currentScreen = 'home';
    this.battleConfig = { count: 16, district: 'הכל', type: 'הכל' };
    this.battleState = null;
    this.leaderboard = {
      sortBy: 'population', sortDir: 'desc',
      district: 'הכל', type: 'הכל', search: '',
      filters: {},  // {fieldId: {min, max} or {value}}
    };
    this.filtersOpen = false;
    this.selectMode = false;
    this.selectedCodes = new Set();
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
    } catch (err) {
      console.error(err);
      if (heroSub) heroSub.textContent = 'שגיאה בטעינת נתונים. בדקו חיבור אינטרנט ונסו לרענן.';
      if (loadingBar) loadingBar.classList.remove('active');
      this.enableButtons(false);
    }
  }

  enableButtons(enabled) {
    ['btn-battle-mode', 'btn-leaderboard-mode'].forEach(id => {
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
      setup: document.getElementById('screen-setup'),
      battle: document.getElementById('screen-battle'),
      results: document.getElementById('screen-results'),
      leaderboard: document.getElementById('screen-leaderboard'),
    };
    this.headerTitle = document.getElementById('header-title-text');
    this.headerBack = document.getElementById('header-back');
  }

  bindEvents() {
    this.headerBack.addEventListener('click', () => this.goBack());

    document.getElementById('btn-battle-mode').addEventListener('click', () => {
      if (!this.dataReady) return;
      this.showScreen('setup');
    });
    document.getElementById('btn-leaderboard-mode').addEventListener('click', () => {
      if (!this.dataReady) return;
      this.renderLeaderboard();
      this.showScreen('leaderboard');
    });

    document.getElementById('start-battle').addEventListener('click', () => this.startBattle());

    document.querySelectorAll('.count-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.count-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.battleConfig.count = parseInt(chip.dataset.count);
      });
    });

    document.querySelectorAll('#setup-districts .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#setup-districts .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.battleConfig.district = chip.dataset.value;
      });
    });

    document.querySelectorAll('#setup-types .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#setup-types .filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.battleConfig.type = chip.dataset.value;
      });
    });

    document.getElementById('lb-search').addEventListener('input', (e) => {
      this.leaderboard.search = e.target.value;
      this.renderLeaderboardList();
    });

    document.querySelectorAll('.sort-btn').forEach(btn => {
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

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
    document.getElementById('modal-close-btn').addEventListener('click', () => this.closeModal());

    document.getElementById('btn-play-again').addEventListener('click', () => this.showScreen('setup'));
    document.getElementById('btn-share').addEventListener('click', () => this.shareResults());
    document.getElementById('btn-home').addEventListener('click', () => this.showScreen('home'));

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
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    this.screens[name].classList.add('active');
    this.currentScreen = name;

    const titles = {
      home: '🏘️ מדרג הישובים',
      setup: '⚙️ הגדרות משחק',
      battle: '⚔️ מי עדיף?',
      results: '🏆 התוצאות',
      leaderboard: '📊 טבלת ישובים',
    };
    this.headerTitle.textContent = titles[name] || '';
    this.headerBack.classList.toggle('hidden', name === 'home');
    window.scrollTo(0, 0);
  }

  goBack() {
    const backMap = { setup: 'home', battle: 'setup', results: 'home', leaderboard: 'home' };
    this.showScreen(backMap[this.currentScreen] || 'home');
  }

  // ==========================================
  // Battle Mode
  // ==========================================
  startBattle() {
    let pool = [...YISHUVIM];
    if (this.battleConfig.district !== 'הכל') pool = pool.filter(y => y.district === this.battleConfig.district);
    if (this.battleConfig.type !== 'הכל') pool = pool.filter(y => y.type === this.battleConfig.type);
    pool = this.shuffle(pool);
    const count = Math.min(this.battleConfig.count, pool.length);
    if (count < 2) { alert('אין מספיק ישובים להשוואה. נסו לשנות את הסינון.'); return; }
    const selected = pool.slice(0, count);

    this.battleState = {
      items: selected, result: [],
      sortArr: selected.map((_, i) => i),
      pending: null,
      totalEstimated: Math.ceil(count * Math.log2(count)),
      completedComparisons: 0,
      mergeQueue: [], mergeResults: [],
    };
    this.initMergeSort();
    this.showScreen('battle');
    this.renderBattle();
  }

  initMergeSort() {
    const state = this.battleState;
    const n = state.items.length;
    state.mergeQueue = [];
    state.mergeResults = new Array(n);
    for (let i = 0; i < n; i++) state.mergeResults[i] = i;
    this.buildMergeSteps(0, n - 1);
    state.currentMerge = null;
    this.nextMergeStep();
  }

  buildMergeSteps(left, right) {
    if (left >= right) return;
    const mid = Math.floor((left + right) / 2);
    this.buildMergeSteps(left, mid);
    this.buildMergeSteps(mid + 1, right);
    this.battleState.mergeQueue.push({ left, mid, right });
  }

  nextMergeStep() {
    const state = this.battleState;
    if (state.currentMerge && state.currentMerge.done) {
      const cm = state.currentMerge;
      for (let i = 0; i < cm.merged.length; i++) state.mergeResults[cm.left + i] = cm.merged[i];
    }
    if (state.mergeQueue.length === 0) {
      this.battleState.result = state.mergeResults.map(i => state.items[i]);
      this.showResults();
      return;
    }
    const step = state.mergeQueue.shift();
    state.currentMerge = {
      left: step.left,
      leftArr: state.mergeResults.slice(step.left, step.mid + 1),
      rightArr: state.mergeResults.slice(step.mid + 1, step.right + 1),
      li: 0, ri: 0, merged: [], done: false,
    };
    this.nextComparison();
  }

  nextComparison() {
    const state = this.battleState;
    const cm = state.currentMerge;
    if (!cm) return;
    if (cm.li >= cm.leftArr.length) { cm.merged.push(...cm.rightArr.slice(cm.ri)); cm.done = true; this.nextMergeStep(); return; }
    if (cm.ri >= cm.rightArr.length) { cm.merged.push(...cm.leftArr.slice(cm.li)); cm.done = true; this.nextMergeStep(); return; }
    state.pending = { a: cm.leftArr[cm.li], b: cm.rightArr[cm.ri] };
    this.renderBattle();
  }

  chooseSide(winner) {
    const state = this.battleState;
    const cm = state.currentMerge;
    if (!state.pending) return;
    state.completedComparisons++;
    if (winner === 'a') { cm.merged.push(cm.leftArr[cm.li]); cm.li++; }
    else { cm.merged.push(cm.rightArr[cm.ri]); cm.ri++; }
    this.nextComparison();
  }

  skipComparison() { this.chooseSide(Math.random() < 0.5 ? 'a' : 'b'); }

  renderBattleCard(item) {
    const stats = [
      { label: '👥 אוכלוסייה', val: this.formatNumber(item.population) },
      { label: '📍 מחוז', val: item.district },
      { label: '👶 צעירים', val: item.youthPercent + '%' },
      { label: '👴 קשישים', val: item.elderPercent + '%' },
    ];
    if (item.medianWage) stats.push({ label: '💰 שכר חציוני', val: '₪' + this.formatNumber(item.medianWage) });
    if (item.socioCluster) stats.push({ label: '📊 אשכול', val: item.socioCluster + '/10' });
    if (item.academicPct) stats.push({ label: '🎓 אקדמאים', val: item.academicPct + '%' });

    return `
      <div class="city-name">${item.name}</div>
      <div class="city-stats">
        ${stats.map(s => `<div class="stat-row"><span class="stat-label">${s.label}</span><span class="stat-value">${s.val}</span></div>`).join('')}
      </div>
      <span class="city-type">${item.type}</span>
    `;
  }

  renderBattle() {
    const state = this.battleState;
    if (!state || !state.pending) return;
    const a = state.items[state.pending.a];
    const b = state.items[state.pending.b];
    const progress = Math.min(100, (state.completedComparisons / state.totalEstimated) * 100);

    document.getElementById('battle-content').innerHTML = `
      <div class="battle-progress">
        <div class="progress-bar-container"><div class="progress-bar" style="width: ${progress}%"></div></div>
        <div class="progress-text">השוואה ${state.completedComparisons + 1} מתוך ~${state.totalEstimated}</div>
      </div>
      <div class="battle-hint">🤔 איפה הייתם מעדיפים לגור?</div>
      <div class="battle-vs">
        <div class="battle-card" onclick="app.chooseSide('a')" style="animation: slideInRight 0.3s ease">
          ${this.renderBattleCard(a)}
        </div>
        <div class="vs-badge">VS</div>
        <div class="battle-card" onclick="app.chooseSide('b')" style="animation: slideInLeft 0.3s ease">
          ${this.renderBattleCard(b)}
        </div>
      </div>
      <button class="skip-btn" onclick="app.skipComparison()">⏭️ דלג (בחירה אקראית)</button>
    `;
  }

  // ==========================================
  // Results
  // ==========================================
  showResults() { this.showScreen('results'); this.renderResults(); }

  renderResults() {
    const results = this.battleState.result;
    document.getElementById('results-list').innerHTML = results.map((item, i) => {
      let cls = '', medalEmoji = '';
      if (i === 0) { cls = 'gold'; medalEmoji = '🥇'; }
      else if (i === 1) { cls = 'silver'; medalEmoji = '🥈'; }
      else if (i === 2) { cls = 'bronze'; medalEmoji = '🥉'; }
      return `
        <div class="result-item ${cls}" onclick="app.showDetail(${YISHUVIM.indexOf(item)})" style="animation-delay: ${i * 0.05}s">
          <div class="result-rank">${medalEmoji || (i + 1)}</div>
          <div class="result-info">
            <div class="result-name">${item.name}</div>
            <div class="result-desc">${item.district} · ${item.type}</div>
          </div>
          <div class="result-pop">${this.formatNumber(item.population)}</div>
        </div>
      `;
    }).join('');
    document.getElementById('winner-name').textContent = results[0]?.name || '';
  }

  shareResults() {
    const results = this.battleState.result;
    const text = `🏘️ הדירוג שלי - מדרג הישובים:\n\n` +
      results.slice(0, 10).map((item, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        return `${medals[i] || (i + 1) + '.'} ${item.name}`;
      }).join('\n') + `\n\nנוצר עם מדרג הישובים 🇮🇱`;
    if (navigator.share) navigator.share({ title: 'מדרג הישובים', text });
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => alert('הדירוג הועתק ללוח! 📋'));
    else alert(text);
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

    // Apply advanced filters
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
    const icon = cat ? cat.icon : '';

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

      return `
        <div class="leaderboard-item ${isSelected ? 'selected' : ''}" onclick="app.showDetail(${origIndex})">
          ${checkbox}
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

  // ==========================================
  // Detail Modal
  // ==========================================
  showDetail(index) {
    if (index < 0 || index >= YISHUVIM.length) return;
    const item = YISHUVIM[index];
    document.getElementById('modal-title').textContent = item.name;
    document.getElementById('modal-subtitle').textContent = `${item.district} · ${item.type}`;

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
    // select all currently filtered/visible items
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

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

const app = new YishuvRanker();
