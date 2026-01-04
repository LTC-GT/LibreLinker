// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * LibreLinker
 * Copyright (C) 2025
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Initialize theme before page renders to prevent flash
(function() {
    const savedTheme = localStorage.getItem('theme');
    let theme;
    
    if (savedTheme) {
        // Use saved preference
        theme = savedTheme;
    } else {
        // Match browser's color scheme preference
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    }
})();

class LibreLinker {
    constructor() {
        this.projects = [];
        // Multi-column sort state: ordered array of { column, direction }
        this.sortState = [];
        this.hasUserSorted = false;
        this.activeFilters = new Set();
        this.ltcOnTop = true; // null = off, true = LTC on top, false = LTC on bottom
        
        // Pinch-to-zoom properties
        this.scale = 1;
        this.initialDistance = 0;
        this.initialScale = 1;
        
        // Detect touch device
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        this.init();
    }

    async init() {
        await this.loadProjects();
        this.setupSortHandlers();
        this.setupFilterHandlers();
        this.setupPinchZoom();
        
        // If any filters are enabled on startup, disable LTC supported sort
        if (this.activeFilters.size > 0) {
            this.ltcOnTop = null;
        }
        
        this.render();
    }

    async loadProjects() {
        try {
            const response = await fetch('projects.json');
            const allProjects = await response.json();
            
            // Separate LTC and non-LTC projects
            const ltcProjects = allProjects.filter(p => p.ltcSupported === true);
            const nonLtcProjects = allProjects.filter(p => p.ltcSupported !== true);
            
            // Randomize each group independently
            ltcProjects.sort(() => Math.random() - 0.5);
            nonLtcProjects.sort(() => Math.random() - 0.5);
            
            // LTC projects on top by default
            this.projects = [...ltcProjects, ...nonLtcProjects];
        } catch (error) {
            console.error('Error loading projects:', error);
            this.projects = [];
        }
    }

    setupSortHandlers() {
        const headers = document.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const column = header.getAttribute('data-sort');
                
                // Special handling for ltcSupported column - cycle through three states
                if (column === 'ltcSupported') {
                    // Cycle: null (off) -> true (LTC on top) -> false (LTC on bottom) -> null
                    if (this.ltcOnTop === null) {
                        this.ltcOnTop = true;
                    } else if (this.ltcOnTop === true) {
                        this.ltcOnTop = false;
                    } else {
                        this.ltcOnTop = null;
                    }
                    this.updateSortIndicators();
                    this.render();
                    return;
                }
                
                // Regular multi-column sort for other columns
                const idx = this.sortState.findIndex(s => s.column === column);
                if (idx === -1) {
                    // Add as ascending
                    this.sortState.push({ column, direction: 'asc' });
                    this.hasUserSorted = true;
                } else {
                    const current = this.sortState[idx];
                    if (current.direction === 'asc') {
                        // Switch to desc
                        this.sortState[idx].direction = 'desc';
                        this.hasUserSorted = true;
                    } else if (current.direction === 'desc') {
                        // Remove column (toggle off)
                        this.sortState.splice(idx, 1);
                        // If no sorts left, revert to default randomized order
                        if (this.sortState.length === 0) this.hasUserSorted = false;
                    }
                }
                this.updateSortIndicators();
                this.render();
            });
        });
    }

    setupFilterHandlers() {
        const filterButtons = document.querySelectorAll('[data-filter-type]');
        filterButtons.forEach(button => {
            // Check if button is already active on page load (has active styling)
            if (button.classList.contains('bg-brand-gold') && button.classList.contains('text-white')) {
                const type = button.getAttribute('data-filter-type');
                this.activeFilters.add(type);
            }
            
            button.addEventListener('click', () => {
                const type = button.getAttribute('data-filter-type');
                if (this.activeFilters.has(type)) {
                    this.activeFilters.delete(type);
                    button.classList.remove('bg-brand-gold', 'text-white');
                    button.classList.add('bg-gray-100', 'text-gray-700');
                } else {
                    this.activeFilters.add(type);
                    button.classList.remove('bg-gray-100', 'text-gray-700');
                    button.classList.add('bg-brand-gold', 'text-white');
                    // Turn off LTC Supported filter when any other filter is applied
                    this.ltcOnTop = null;
                }
                this.updateSortIndicators();
                this.render();
            });
        });
    }

    setupPinchZoom() {
        const tableContainer = document.querySelector('.overflow-x-auto');
        const table = tableContainer?.querySelector('table');
        
        if (!tableContainer || !table) return;

        // Reset zoom on page load
        this.scale = 1;
        table.style.transform = 'scale(1)';
        table.style.transformOrigin = 'top center';
        table.style.transition = 'none';
        table.style.width = '100%';

        let touches = [];

        const getDistance = (touch1, touch2) => {
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const updateTableWidth = (scale) => {
            // Adjust table width inversely to scale to maintain proper spacing
            if (scale < 1) {
                table.style.width = `${100 / scale}%`;
            } else {
                table.style.width = '100%';
            }
            
            // Adjust container height to match scaled table height
            if (scale < 1) {
                const tableHeight = table.offsetHeight;
                tableContainer.style.height = `${tableHeight * scale}px`;
            } else {
                tableContainer.style.height = 'auto';
            }
        };

        tableContainer.addEventListener('touchstart', (e) => {
            touches = Array.from(e.touches);
            
            if (touches.length === 2) {
                e.preventDefault();
                this.initialDistance = getDistance(touches[0], touches[1]);
                this.initialScale = this.scale;
            }
        }, { passive: false });

        tableContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                
                touches = Array.from(e.touches);
                const currentDistance = getDistance(touches[0], touches[1]);
                const scaleChange = currentDistance / this.initialDistance;
                
                // Calculate new scale with constraints (0.5x to 3x zoom)
                this.scale = Math.max(0.5, Math.min(3, this.initialScale * scaleChange));
                
                table.style.transform = `scale(${this.scale})`;
                updateTableWidth(this.scale);
            }
        }, { passive: false });

        tableContainer.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                touches = [];
                this.initialDistance = 0;
            }
        });
    }

    getFilteredProjects() {
        if (this.activeFilters.size === 0) {
            return this.projects;
        }
        // AND logic: project must have ALL selected filter types
        return this.projects.filter(project => 
            Array.from(this.activeFilters).every(filterType => 
                project.types.includes(filterType)
            )
        );
    }

    updateSortIndicators() {
        const headers = document.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            const icon = header.querySelector('.sort-icon');
            const column = header.getAttribute('data-sort');
            if (!icon) return;
            
            // Special handling for ltcSupported column - three states
            if (column === 'ltcSupported') {
                icon.setAttribute('aria-hidden', 'true');
                if (this.ltcOnTop === true) {
                    // LTC on top
                    icon.innerHTML = '<svg class="inline w-3 h-3 align-middle" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l3 3H5l3-3z"/></svg>';
                    icon.classList.remove('opacity-30');
                } else if (this.ltcOnTop === false) {
                    // LTC on bottom
                    icon.innerHTML = '<svg class="inline w-3 h-3 align-middle" viewBox="0 0 16 16" fill="currentColor"><path d="M8 15l-3-3h6l-3 3z"/></svg>';
                    icon.classList.remove('opacity-30');
                } else {
                    // Off state (null)
                    icon.innerHTML = '<svg class="inline w-3 h-3 align-middle" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l3 3H5l3-3zm0 14l-3-3h6l-3 3z"/></svg>';
                    icon.classList.add('opacity-30');
                }
                return;
            }
            
            // Regular sort indicators for other columns
            const state = this.sortState.find(s => s.column === column);
            if (state) {
                icon.innerHTML = state.direction === 'asc'
                    ? '<svg class="inline w-3 h-3 align-middle" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l3 3H5l3-3z"/></svg>'
                    : '<svg class="inline w-3 h-3 align-middle" viewBox="0 0 16 16" fill="currentColor"><path d="M8 15l-3-3h6l-3 3z"/></svg>';
                icon.classList.remove('opacity-30');
            } else {
                // Bi-directional indicator (neutral)
                icon.innerHTML = '<svg class="inline w-3 h-3 align-middle" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l3 3H5l3-3zm0 14l-3-3h6l-3 3z"/></svg>';
                icon.classList.add('opacity-30');
            }
        });
    }

    sortProjects() {
        const filteredProjects = this.getFilteredProjects();
        
        // If ltcOnTop is null (off), don't separate LTC projects
        if (this.ltcOnTop === null) {
            // Apply sorting to all projects together
            if (this.hasUserSorted && this.sortState.length > 0) {
                const sortFn = (a, b) => {
                    for (const { column, direction } of this.sortState) {
                        let aVal = a[column];
                        let bVal = b[column];

                        // Special handling for license arrays
                        if (column === 'license') {
                            aVal = Array.isArray(aVal) ? aVal[0] : aVal;
                            bVal = Array.isArray(bVal) ? bVal[0] : bVal;
                        }

                        // Normalize values
                        const aIsString = typeof aVal === 'string';
                        const bIsString = typeof bVal === 'string';
                        if (aIsString) aVal = aVal.toLowerCase();
                        if (bIsString) bVal = bVal.toLowerCase();

                        let cmp = 0;
                        if (aIsString && bIsString) {
                            cmp = aVal.localeCompare(bVal);
                        } else {
                            if (aVal > bVal) cmp = 1;
                            else if (aVal < bVal) cmp = -1;
                            else cmp = 0;
                        }

                        if (cmp !== 0) {
                            return direction === 'asc' ? cmp : -cmp;
                        }
                    }
                    return 0;
                };
                return [...filteredProjects].sort(sortFn);
            }
            // No sorting, return as-is (randomized)
            return filteredProjects;
        }
        
        // Separate LTC and non-LTC projects
        let ltcProjects = filteredProjects.filter(p => p.ltcSupported === true);
        let nonLtcProjects = filteredProjects.filter(p => p.ltcSupported !== true);
        
        // Apply sorting to each group independently if user has sorted
        if (this.hasUserSorted && this.sortState.length > 0) {
            const sortFn = (a, b) => {
                for (const { column, direction } of this.sortState) {
                    let aVal = a[column];
                    let bVal = b[column];

                    // Special handling for license arrays
                    if (column === 'license') {
                        aVal = Array.isArray(aVal) ? aVal[0] : aVal;
                        bVal = Array.isArray(bVal) ? bVal[0] : bVal;
                    }

                    // Normalize values
                    const aIsString = typeof aVal === 'string';
                    const bIsString = typeof bVal === 'string';
                    if (aIsString) aVal = aVal.toLowerCase();
                    if (bIsString) bVal = bVal.toLowerCase();

                    let cmp = 0;
                    if (aIsString && bIsString) {
                        cmp = aVal.localeCompare(bVal);
                    } else {
                        if (aVal > bVal) cmp = 1;
                        else if (aVal < bVal) cmp = -1;
                        else cmp = 0;
                    }

                    if (cmp !== 0) {
                        return direction === 'asc' ? cmp : -cmp;
                    }
                }
                return 0;
            };
            
            ltcProjects = [...ltcProjects].sort(sortFn);
            nonLtcProjects = [...nonLtcProjects].sort(sortFn);
        }
        
        // Return with LTC on top or bottom based on ltcOnTop state
        if (this.ltcOnTop === true) {
            return [...ltcProjects, ...nonLtcProjects];
        } else {
            return [...nonLtcProjects, ...ltcProjects];
        }
    }

    getProjectIcon(type) {
        const icons = {
            'ai': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>`,
            'academic': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 14l9-5-9-5-9 5 9 5z"/>
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"/>
            </svg>`,
            'research': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
            </svg>`,
            'hardware': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
            </svg>`,
            'web': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
            </svg>`,
            'mobile': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>`,
            'enterprise': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>`,
            'plugin': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
            </svg>`,
            'just-for-fun': `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>`
        };
        return icons[type] || icons['web'];
    }

    getTypeDescription(type) {
        const descriptions = {
            'ai': 'Artificial Intelligence & Machine Learning project',
            'academic': 'Academic or educational project',
            'research': 'Research & development project',
            'hardware': 'Hardware, HPC, or low-level systems project',
            'web': 'Web application or online service',
            'mobile': 'Mobile application project',
            'enterprise': 'Enterprise-scale or large organization project',
            'plugin': 'Plugin or extension for existing software',
            'just-for-fun': 'Fun, experimental, or hobby project'
        };
        return descriptions[type] || 'Project type';
    }

    showTooltip(event, type, isMobileClick = false) {
        // On touch devices, only respond to explicit clicks, not hover
        if (this.isTouchDevice && !isMobileClick) {
            return;
        }

        const existingTooltip = document.querySelector('.icon-tooltip');
        if (existingTooltip) {
            // On mobile click, if same tooltip is shown, hide it
            if (isMobileClick && existingTooltip.dataset.type === type) {
                if (existingTooltip._scrollHandler) {
                    window.removeEventListener('scroll', existingTooltip._scrollHandler);
                    document.querySelector('.overflow-x-auto')?.removeEventListener('scroll', existingTooltip._scrollHandler);
                }
                existingTooltip.remove();
                return;
            }
            if (existingTooltip._scrollHandler) {
                window.removeEventListener('scroll', existingTooltip._scrollHandler);
                document.querySelector('.overflow-x-auto')?.removeEventListener('scroll', existingTooltip._scrollHandler);
            }
            existingTooltip.remove();
        }

        const tooltip = document.createElement('div');
        tooltip.className = 'icon-tooltip';
        tooltip.textContent = this.getTypeDescription(type);
        tooltip.dataset.type = type;
        tooltip.dataset.isMobile = isMobileClick;
        
        const rect = event.currentTarget.getBoundingClientRect();
        tooltip.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top - 40}px;
            transform: translateX(-50%);
            background: rgba(0, 48, 87, 0.95);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 1000;
            pointer-events: ${isMobileClick ? 'auto' : 'none'};
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        `;

        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: absolute;
            bottom: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid rgba(0, 48, 87, 0.95);
        `;
        tooltip.appendChild(arrow);

        document.body.appendChild(tooltip);

        // Update position as user scrolls (for both mobile and desktop)
        const iconElement = event.currentTarget;
        const updatePosition = () => {
            const currentRect = iconElement.getBoundingClientRect();
            tooltip.style.left = `${currentRect.left + currentRect.width / 2}px`;
            tooltip.style.top = `${currentRect.top - 40}px`;
        };
        
        // Store scroll handler for cleanup
        tooltip._scrollHandler = updatePosition;
        window.addEventListener('scroll', updatePosition, { passive: true });
        document.querySelector('.overflow-x-auto')?.addEventListener('scroll', updatePosition, { passive: true });
    }

    hideTooltip() {
        const tooltip = document.querySelector('.icon-tooltip');
        if (tooltip) {
            // Don't hide on desktop hover-out if it's a mobile-clicked tooltip
            if (tooltip.dataset.isMobile === 'true') {
                return;
            }
            // Clean up scroll listeners
            if (tooltip._scrollHandler) {
                window.removeEventListener('scroll', tooltip._scrollHandler);
                document.querySelector('.overflow-x-auto')?.removeEventListener('scroll', tooltip._scrollHandler);
            }
            tooltip.remove();
        }
    }

    showDescriptionPopup(projectName, description) {
        // Remove any existing popup
        this.closeDescriptionPopup();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'description-overlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.closeDescriptionPopup();
            }
        };

        // Create popup
        const popup = document.createElement('div');
        popup.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto';
        popup.innerHTML = `
            <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6 flex items-start justify-between">
                <h3 class="text-lg sm:text-xl font-bold text-brand-navy dark:text-brand-gold pr-4">${projectName}</h3>
                <button 
                    onclick="window.libreLinker.closeDescriptionPopup()"
                    class="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    aria-label="Close">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="p-4 sm:p-6">
                <p class="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">${description}</p>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Prevent body scroll when popup is open
        document.body.style.overflow = 'hidden';
    }

    closeDescriptionPopup() {
        const overlay = document.getElementById('description-overlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
    }

    showTechnologiesPopup(projectName, technologies) {
        // Remove any existing popup
        this.closeDescriptionPopup();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'description-overlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.closeDescriptionPopup();
            }
        };

        // Create popup
        const popup = document.createElement('div');
        popup.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto';
        popup.innerHTML = `
            <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6 flex items-start justify-between">
                <h3 class="text-lg sm:text-xl font-bold text-brand-navy dark:text-brand-gold pr-4">${projectName} - Technologies</h3>
                <button 
                    onclick="window.libreLinker.closeDescriptionPopup()"
                    class="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="p-4 sm:p-6">
                <div class="flex flex-wrap gap-2">
                    ${technologies.map(tech => `
                        <span class="px-3 py-1.5 bg-brand-gold bg-opacity-10 dark:bg-opacity-20 text-brand-navy dark:text-brand-gold text-sm font-medium rounded-full border border-brand-gold border-opacity-20">
                            ${tech}
                        </span>
                    `).join('')}
                </div>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Prevent body scroll when popup is open
        document.body.style.overflow = 'hidden';
    }

    render() {
        const tbody = document.getElementById('projects-tbody');
        if (!this.projects.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-8 text-gray-500">
                        No projects found. Add projects to projects.json to get started.
                    </td>
                </tr>
            `;
            return;
        }

        const sorted = this.sortProjects();
        
        if (sorted.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-16">
                        <div class="text-6xl mb-4">☹️</div>
                        <p class="text-gray-600 font-medium">No projects match your selected filters</p>
                        <p class="text-gray-500 text-sm mt-2">Try selecting different project types</p>
                    </td>
                </tr>
            `;
            return;
        }
        tbody.innerHTML = sorted.map(project => `
            <tr class="border-b border-gray-200 dark:border-gray-700 hover:bg-brand-gold hover:bg-opacity-5 dark:hover:bg-opacity-10 transition-colors">
                <td class="py-2 sm:py-3 px-2 sm:px-4">
                    <div class="flex items-center gap-2 sm:gap-3">
                        <a href="${project.url}" target="_blank" rel="noopener noreferrer" class="flex-shrink-0" aria-label="Open ${project.name}">
                            <div class="w-8 h-8 sm:w-12 sm:h-12 rounded ${project.logo ? 'bg-gray-100 dark:bg-white border-2 border-brand-gold' : 'bg-gradient-to-br from-brand-navy to-brand-gold dark:from-gray-700 dark:to-brand-gold'} flex items-center justify-center">
                                ${project.logo 
                                    ? `<img src="${project.logo}" alt="${project.name} logo" class="w-6 h-6 sm:w-10 sm:h-10 object-contain" loading="lazy" width="40" height="40">`
                                    : `<span class="text-white font-bold text-sm sm:text-xl">${project.name.substring(0, 2).toUpperCase()}</span>`
                                }
                            </div>
                        </a>
                        <div class="min-w-0">
                            <a href="${project.url}" target="_blank" rel="noopener noreferrer" class="text-sm sm:text-base font-semibold text-brand-navy dark:text-brand-gold hover:underline block truncate">
                                ${project.name}
                            </a>
                        </div>
                    </div>
                </td>
                <td class="py-2 sm:py-3 px-2 sm:px-4">
                    <div class="text-xs sm:text-sm text-gray-700 dark:text-gray-300 line-clamp-2 sm:line-clamp-3 cursor-pointer hover:text-brand-gold transition-colors" 
                         onclick="window.libreLinker.showDescriptionPopup('${project.name}', \`${project.description.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">
                        ${project.description}
                    </div>
                </td>
                <td class="py-2 sm:py-3 px-2 sm:px-4">
                    <div class="flex gap-1 sm:gap-2 flex-wrap">
                        ${project.types.map(type => `
                            <span class="text-brand-navy dark:text-brand-gold hover:scale-110 transition-transform cursor-help" 
                                  onclick="window.libreLinker.showTooltip(event, '${type}', true)"
                                  onmouseenter="window.libreLinker.showTooltip(event, '${type}')"
                                  onmouseleave="window.libreLinker.hideTooltip()">
                                ${this.getProjectIcon(type)}
                            </span>
                        `).join('')}
                    </div>
                </td>
                <td class="py-2 sm:py-3 px-2 sm:px-4">
                    <div class="flex flex-wrap gap-1 sm:gap-1.5 cursor-pointer" 
                         onclick="window.libreLinker.showTechnologiesPopup('${project.name}', ${JSON.stringify(project.technologies).replace(/"/g, '&quot;')})">
                        ${project.technologies.slice(0, 2).map(tech => `
                            <span class="px-2 py-0.5 bg-brand-gold bg-opacity-10 dark:bg-opacity-20 text-brand-navy dark:text-brand-gold text-[10px] sm:text-xs font-medium rounded-full border border-brand-gold border-opacity-20 whitespace-nowrap">
                                ${tech}
                            </span>
                        `).join('')}
                        ${project.technologies.length > 2 ? 
                            `<span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap">
                                +${project.technologies.length - 2}
                            </span>` : ''
                        }
                    </div>
                </td>
                <td class="py-2 sm:py-3 px-2 sm:px-4 text-center">
                    <span class="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">${project.yearStarted}</span>
                </td>
                <td class="py-2 sm:py-3 px-2 sm:px-4 text-center">
                    ${Array.isArray(project.license) 
                        ? project.license.map(lic => `
                            <a href="https://directory.fsf.org/wiki/License:${lic.replace(/\s+/g, '')}" 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               class="text-xs sm:text-sm text-brand-gold hover:underline font-medium block">
                                ${lic}
                            </a>
                        `).join('')
                        : `<a href="https://directory.fsf.org/wiki/License:${project.license.replace(/\s+/g, '')}" 
                             target="_blank" 
                             rel="noopener noreferrer" 
                             class="text-xs sm:text-sm text-brand-gold hover:underline font-medium">
                            ${project.license}
                        </a>`
                    }
                </td>
                <td class="py-2 sm:py-3 px-2 sm:px-4 text-center">
                    <span class="px-2 sm:px-3 py-0.5 sm:py-1 ${project.status === 'Dormant' ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'} text-[10px] sm:text-xs font-medium rounded-full whitespace-nowrap">
                        ${project.status}
                    </span>
                </td>
                <td class="py-2 sm:py-3 px-2 sm:px-4 text-center">
                    <span class="text-base sm:text-lg">${project.ltcSupported ? '✅' : '-'}</span>
                </td>
            </tr>
        `).join('');
        
        // Update sort indicators after rendering
        this.updateSortIndicators();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.libreLinker = new LibreLinker();
    
    // Close description popup on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.libreLinker) {
            window.libreLinker.closeDescriptionPopup();
        }
    });

    // Close mobile tooltip when clicking outside
    document.addEventListener('click', (e) => {
        const tooltip = document.querySelector('.icon-tooltip');
        if (tooltip && tooltip.dataset.isMobile === 'true') {
            // Check if click is outside both the tooltip and any type icon
            const isTypeIcon = e.target.closest('[onclick*="showTooltip"]');
            if (!tooltip.contains(e.target) && !isTypeIcon) {
                if (tooltip._scrollHandler) {
                    window.removeEventListener('scroll', tooltip._scrollHandler);
                    document.querySelector('.overflow-x-auto')?.removeEventListener('scroll', tooltip._scrollHandler);
                }
                tooltip.remove();
            }
        }
    });

    // Initialize EmailJS with your public key
    (function() {
        emailjs.init('Jnr_UizV5u1ofINaQ');
    })();

    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');

    function updateThemeIcons() {
        if (!sunIcon || !moonIcon) return;
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        } else {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcons();
        });
    }

    // Initialize theme icons on load
    updateThemeIcons();

    // FAQ Accordion Toggle
    document.querySelectorAll('.faq-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const content = button.nextElementSibling;
            const icon = button.querySelector('.faq-icon');
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            
            // Toggle current FAQ
            button.setAttribute('aria-expanded', !isExpanded);
            content.classList.toggle('hidden');
            icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
        });
    });

    // Info toggle for mobile
    const infoToggle = document.getElementById('info-toggle');
    if (infoToggle) {
        infoToggle.addEventListener('click', () => {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50';
            modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] overflow-y-auto">
                <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-brand-navy dark:text-brand-gold">About LibreLinker</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="p-6">
                    <p class="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4">
                        A curated collection of innovative open projects spanning AI, chemistry, hardware, and beyond - all seeking contributors!
                    </p>
                    <p class="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4">
                        All projects <a href="https://www.gnu.org/philosophy/free-sw.en.html" target="_blank" rel="noopener noreferrer" class="text-brand-gold hover:underline">respect your freedom</a> and are GPL-compatible. Most all are led by Georgia Tech students, faculty, and alumni.
                    </p>
                    <p class="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4">
                        <a href="https://ltc.gtorg.gatech.edu/" target="_blank" rel="noopener noreferrer" class="text-brand-gold hover:underline font-medium">LibreTech Collective</a>, Georgia Tech's only Free & Open-Source club, invites you to explore, contribute, and make an impact!
                    </p>
                    <p class="text-[11px] text-gray-600 dark:text-gray-400 mb-4 text-center flex items-center justify-center gap-1 leading-none">
                        <span>Built with ❤️ in Atlanta, Georgia</span>
                        <a href="https://gatech.edu" target="_blank" rel="noopener noreferrer" class="hover:opacity-80 transition-opacity" aria-label="Visit Georgia Tech">
                            <img class="inline-block h-4 w-auto" src="misc/img/us-flag.svg" alt="US Flag" style="vertical-align: middle;">
                        </a>
                    </p>
                    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <p class="text-gray-600 dark:text-gray-400 text-xs mb-3">Connect with us:</p>
                        <div class="flex items-center gap-4 justify-center">
                            <a href="https://github.com/LTC-GT" target="_blank" rel="noopener noreferrer" class="hover:opacity-80 transition-opacity" aria-label="View on GitHub">
                                <svg class="w-6 h-6 fill-current text-gray-300 hover:text-brand-gold transition-colors" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                                </svg>
                            </a>
                            <a href="https://www.linkedin.com/company/gtltc" target="_blank" rel="noopener noreferrer" class="hover:opacity-80 transition-opacity" aria-label="Visit our LinkedIn">
                                <svg class="w-6 h-6 fill-current text-gray-300 hover:text-brand-gold transition-colors" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"></path>
                                </svg>
                            </a>
                            <a href="https://www.instagram.com/libretechcollectivegt/" target="_blank" rel="noopener noreferrer" class="hover:opacity-80 transition-opacity" aria-label="Follow us on Instagram">
                                <svg class="w-6 h-6 fill-current text-gray-300 hover:text-brand-gold transition-colors" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"></path>
                                </svg>
                            </a>
                            <a href="https://discord.gg/E6qgerDpTr" target="_blank" rel="noopener noreferrer" class="hover:opacity-80 transition-opacity" aria-label="Join our Discord">
                                <svg class="w-6 h-6 fill-current text-gray-300 hover:text-brand-gold transition-colors" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z"></path>
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        });
    }

    // Elements
    const reasonSelect = document.getElementById('reason');
    const gplConfirmContainer = document.getElementById('gpl_confirm_container');
    const gplCheckbox = document.getElementById('gpl_confirm');
    const submitBtn = document.getElementById('submit-btn');
    const gplHelpBtn = document.getElementById('gpl-help-btn');
    const gplTooltip = document.getElementById('gpl-tooltip');
    const ltcHelpBtn = document.getElementById('ltc-help-btn');
    const ltcTooltip = document.getElementById('ltc-tooltip');

    // Handle reason selection change
    if (reasonSelect) {
        reasonSelect.addEventListener('change', function() {
            const selectedReason = this.value;
            
            // Reset checkbox
            gplCheckbox.checked = false;
            gplCheckbox.removeAttribute('required');
            
            // Show GPL checkbox only for project additions/updates
            if (selectedReason === 'LIBRELINKER: NEW PROJECT ADDITION REQUEST' || 
                selectedReason === 'LIBRELINKER: PROJECT UPDATE REQUEST') {
                gplConfirmContainer.classList.remove('hidden');
                gplCheckbox.setAttribute('required', 'required');
            } else {
                gplConfirmContainer.classList.add('hidden');
            }
            
            updateSubmitButton();
        });
    }

    // GPL help tooltip functionality
    if (gplHelpBtn) {
        gplHelpBtn.addEventListener('click', function(e) {
            e.preventDefault();
            gplTooltip.classList.toggle('hidden');
        });
    }

    // LTC help tooltip functionality
    if (ltcHelpBtn) {
        ltcHelpBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle visibility
            const isHidden = ltcTooltip.classList.contains('hidden');
            
            if (isHidden) {
                // Show tooltip
                ltcTooltip.classList.remove('hidden');
                
                // Position the tooltip above the button
                const updatePosition = () => {
                    const btnRect = ltcHelpBtn.getBoundingClientRect();
                    const tooltipRect = ltcTooltip.getBoundingClientRect();
                    
                    // Center horizontally relative to button
                    let left = btnRect.left + (btnRect.width / 2) - (tooltipRect.width / 2);
                    // Position above button with some spacing
                    let top = btnRect.top - tooltipRect.height - 8;
                    
                    // Ensure tooltip stays within viewport horizontally
                    const viewportWidth = window.innerWidth;
                    const rightEdge = left + tooltipRect.width;
                    
                    if (rightEdge > viewportWidth - 10) {
                        // Tooltip would go off right edge, align to right side with padding
                        left = viewportWidth - tooltipRect.width - 10;
                    }
                    if (left < 10) {
                        // Tooltip would go off left edge, align to left side with padding
                        left = 10;
                    }
                    
                    // Ensure tooltip stays within viewport vertically
                    if (top < 10) {
                        top = 10;
                    }
                    
                    ltcTooltip.style.left = `${left}px`;
                    ltcTooltip.style.top = `${top}px`;
                };
                
                // Initial position
                updatePosition();
                
                // Store scroll handler for cleanup
                ltcTooltip._scrollHandler = updatePosition;
                window.addEventListener('scroll', updatePosition, { passive: true });
                document.querySelector('.overflow-x-auto')?.addEventListener('scroll', updatePosition, { passive: true });
            } else {
                // Hide tooltip and remove scroll listeners
                ltcTooltip.classList.add('hidden');
                if (ltcTooltip._scrollHandler) {
                    window.removeEventListener('scroll', ltcTooltip._scrollHandler);
                    document.querySelector('.overflow-x-auto')?.removeEventListener('scroll', ltcTooltip._scrollHandler);
                    ltcTooltip._scrollHandler = null;
                }
            }
        });
    }

    // Close tooltip when clicking outside
    document.addEventListener('click', function(e) {
        if (gplHelpBtn && !gplHelpBtn.contains(e.target) && gplTooltip && !gplTooltip.contains(e.target)) {
            gplTooltip.classList.add('hidden');
        }
        if (ltcHelpBtn && !ltcHelpBtn.contains(e.target) && ltcTooltip && !ltcTooltip.contains(e.target)) {
            ltcTooltip.classList.add('hidden');
            // Clean up scroll listeners
            if (ltcTooltip._scrollHandler) {
                window.removeEventListener('scroll', ltcTooltip._scrollHandler);
                document.querySelector('.overflow-x-auto')?.removeEventListener('scroll', ltcTooltip._scrollHandler);
                ltcTooltip._scrollHandler = null;
            }
        }
    });

    // Custom Bot Prevention System
    let botPreventionPassed = false;
    let captchaStartTime = null;
    let mouseMovements = [];
    let keystrokes = [];
    let currentCaptchaText = '';
    
    // Generate random garbled text with mixed characters
    function generateCaptchaText() {
        // Removed confusing characters: 
        // l, 1, I (look alike)
        // O, 0, o, Q (look alike)
        // S, s, 5 (look alike)
        // Z, z, 2 (look alike)
        // B, 8 (look alike)
        const chars = 'ACDEFGHJKLMNPRTUVWXYabcdefghjkmnpqrtuvwxy34679';
        let text = '';
        for (let i = 0; i < 6; i++) {
            text += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return text;
    }
    
    // Detect iOS Safari (WebKit on iOS)
    function isIOSSafari() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isWebKit = /AppleWebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
        return isiOS && isWebKit;
    }

    // Canvas-based captcha for iOS Safari to avoid transform/filter text bugs
    function renderCanvasCaptcha(captchaTextEl, text) {
        captchaTextEl.innerHTML = '';
        const canvas = document.createElement('canvas');
        const width = captchaTextEl.clientWidth || 320;
        const height = 70;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.textBaseline = 'middle';

        // Background
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--tw-bg-opacity') ? '#fff' : '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Background hatch + light noise lines (subtle for readability)
        ctx.strokeStyle = 'rgba(128,128,128,0.08)';
        for (let x = 0; x < width; x += 6) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + 20, height);
            ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
            ctx.strokeStyle = `rgba(${Math.random()*90|0},${Math.random()*90|0},${Math.random()*90|0},0.18)`;
            ctx.lineWidth = Math.random() * 1.5 + 0.5;
            ctx.beginPath();
            ctx.moveTo(Math.random()*width, Math.random()*height);
            for (let j = 0; j < 4; j++) {
                ctx.lineTo(Math.random()*width, Math.random()*height);
            }
            ctx.stroke();
        }

        // Background geometric shapes behind text
        for (let i = 0; i < 6; i++) {
            const color = `rgba(${Math.random()*120|0},${Math.random()*120|0},${Math.random()*120|0},0.15)`;
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            const cx = Math.random()*width;
            const cy = Math.random()*height;
            const size = Math.random()*18 + 10;
            switch (Math.floor(Math.random()*4)) {
                case 0: // circle
                    ctx.beginPath();
                    ctx.arc(cx, cy, size/2, 0, Math.PI*2);
                    Math.random()>0.5 ? ctx.fill() : ctx.stroke();
                    break;
                case 1: // rect
                    if (Math.random()>0.5) ctx.fillRect(cx-size/2, cy-size/2, size, size);
                    else ctx.strokeRect(cx-size/2, cy-size/2, size, size);
                    break;
                case 2: // triangle
                    ctx.beginPath();
                    ctx.moveTo(cx, cy-size/2);
                    ctx.lineTo(cx+size/2, cy+size/2);
                    ctx.lineTo(cx-size/2, cy+size/2);
                    ctx.closePath();
                    Math.random()>0.5 ? ctx.fill() : ctx.stroke();
                    break;
                default: // diamond
                    ctx.beginPath();
                    ctx.moveTo(cx, cy-size/2);
                    ctx.lineTo(cx+size/2, cy);
                    ctx.lineTo(cx, cy+size/2);
                    ctx.lineTo(cx-size/2, cy);
                    ctx.closePath();
                    Math.random()>0.5 ? ctx.fill() : ctx.stroke();
            }
        }

        // Draw text characters with small random transforms
        const fonts = ['Menlo','Courier New','monospace','Helvetica','Arial','sans-serif','Times','serif'];
        const charSpacing = width / (text.length + 1);
        for (let i = 0; i < text.length; i++) {
            const r = Math.floor(Math.random()*150);
            const g = Math.floor(Math.random()*150);
            const b = Math.floor(Math.random()*150);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            const rotation = (Math.random()*0.5 - 0.25); // less rotation for readability
            const yJitter = Math.random()*8 - 4;
            const scale = 0.95 + Math.random()*0.15; // smaller scale jitter
            const fontSize = 28 * scale;
            ctx.font = `${Math.random()>0.5?'700':'400'} ${fontSize}px ${fonts[Math.floor(Math.random()*fonts.length)]}`;
            const x = (i+1)*charSpacing + (Math.random()*10-5);
            const y = height/2 + yJitter;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);
            ctx.shadowColor = 'rgba(0,0,0,0.12)';
            ctx.shadowBlur = 1.5;
            ctx.shadowOffsetX = Math.random()*2-1;
            ctx.shadowOffsetY = Math.random()*2-1;
            ctx.fillText(text[i], 0, 0);
            ctx.restore();
        }

        // Overlay lines + shapes above text (stronger but controlled)
        for (let i = 0; i < 5; i++) {
            ctx.strokeStyle = `rgba(${Math.random()*110|0},${Math.random()*110|0},${Math.random()*110|0},0.55)`;
            ctx.lineWidth = Math.random()*2.2 + 1.2;
            ctx.beginPath();
            ctx.moveTo(-10, Math.random()*height);
            let currentX = -10;
            while (currentX < width+10) {
                currentX += Math.random()*18 + 6;
                ctx.lineTo(currentX, Math.random()*height);
            }
            ctx.stroke();
        }

        for (let i = 0; i < 6; i++) {
            const color = `rgba(${Math.random()*140|0},${Math.random()*140|0},${Math.random()*140|0},0.35)`;
            ctx.fillStyle = color;
            const cx = Math.random()*width;
            const cy = Math.random()*height;
            const size = Math.random()*16 + 8;
            ctx.beginPath();
            ctx.arc(cx, cy, size/2, 0, Math.PI*2);
            ctx.fill();
        }

        // Per-character squiggle overlays to cross glyphs without fully obscuring
        const charSpacingForOverlay = width / (text.length + 1);
        for (let i = 0; i < text.length; i++) {
            const baseX = (i+1)*charSpacingForOverlay;
            const baseY = height/2;
            ctx.strokeStyle = `rgba(${Math.random()*90|0},${Math.random()*90|0},${Math.random()*90|0},0.6)`;
            ctx.lineWidth = Math.random()*1.6 + 1.2;
            ctx.beginPath();
            // Small zigzag crossing the character area
            const startX = baseX - 14 + (Math.random()*6-3);
            const startY = baseY - 18 + (Math.random()*6-3);
            ctx.moveTo(startX, startY);
            let segX = startX;
            let segY = startY;
            for (let s = 0; s < 6; s++) {
                segX += 5 + Math.random()*6;
                segY += (s % 2 === 0 ? 1 : -1) * (4 + Math.random()*5);
                ctx.lineTo(segX, segY);
            }
            ctx.stroke();
        }

        captchaTextEl.appendChild(canvas);
    }

    // Obfuscate text using a unified canvas-based captcha (same on iOS and desktop)
    function obfuscateCaptchaDisplay(text) {
        const captchaTextEl = document.getElementById('captcha-text');
        if (!captchaTextEl) return;
        // Ensure consistent look across platforms
        captchaTextEl.style.filter = 'none';
        renderCanvasCaptcha(captchaTextEl, text);
        // Add back DOM-based overlay symbols (no circles or Xs)
        addDomCaptchaShapes(captchaTextEl);
    }

    // Add DOM-based shapes over the captcha to increase visual complexity
    function addDomCaptchaShapes(captchaTextEl) {
        // Remove prior DOM shapes
        const oldShapes = captchaTextEl.querySelectorAll('.captcha-dom-shape');
        oldShapes.forEach(el => el.remove());

        const count = 10; // reasonable amount
        for (let i = 0; i < count; i++) {
            const shape = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            shape.classList.add('captcha-dom-shape');
            shape.style.position = 'absolute';
            shape.style.left = Math.random() * 95 + '%';
            shape.style.top = Math.random() * 70 + 15 + '%';
            const size = Math.random() * 18 + 10;
            shape.style.width = size + 'px';
            shape.style.height = size + 'px';
            shape.style.transform = `rotate(${Math.random() * 360}deg)`;
            shape.style.pointerEvents = 'none';
            shape.style.zIndex = '11';
            shape.setAttribute('viewBox', '0 0 20 20');

            // Colors (semi-transparent)
            const color = `rgba(${Math.floor(Math.random()*150)}, ${Math.floor(Math.random()*150)}, ${Math.floor(Math.random()*150)}, 0.45)`;

            // Choose shape type excluding circles and Xs
            const shapeType = Math.floor(Math.random() * 5); // triangle, diamond, star, pentagon, hexagon
            let polygon;
            switch (shapeType) {
                case 0: // Triangle
                    polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', '10,2 18,18 2,18');
                    break;
                case 1: // Diamond
                    polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', '10,2 18,10 10,18 2,10');
                    break;
                case 2: // Star
                    polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', '10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8');
                    break;
                case 3: // Pentagon
                    polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', '10,2 17,8 14,18 6,18 3,8');
                    break;
                default: // Hexagon
                    polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', '10,2 17,6 17,14 10,18 3,14 3,6');
                    break;
            }
            polygon.setAttribute('fill', Math.random() > 0.5 ? color : 'none');
            polygon.setAttribute('stroke', color);
            polygon.setAttribute('stroke-width', '1.5');
            shape.appendChild(polygon);
            captchaTextEl.appendChild(shape);
        }
    }
    
    // Initialize captcha
    function initBotPrevention() {
        const captchaTextEl = document.getElementById('captcha-text');
        const captchaInput = document.getElementById('captcha-input');
        const widget = document.getElementById('bot-prevention-widget');
        const refreshBtn = document.getElementById('captcha-refresh');
        
        if (!captchaTextEl || !captchaInput || !widget) return;
        
        currentCaptchaText = generateCaptchaText();
        obfuscateCaptchaDisplay(currentCaptchaText);
        captchaStartTime = Date.now();
        mouseMovements = [];
        keystrokes = [];
        botPreventionPassed = false;
        // Make sure refresh button starts visible
        if (refreshBtn) {
            refreshBtn.classList.remove('hidden');
        }
        
        // Track mouse movements in widget area
        widget.addEventListener('mousemove', function(e) {
            if (!botPreventionPassed) {
                mouseMovements.push({
                    x: e.clientX,
                    y: e.clientY,
                    time: Date.now()
                });
                // Keep only last 50 movements
                if (mouseMovements.length > 50) mouseMovements.shift();
            }
        });
        
        // Track keystroke timing
        captchaInput.addEventListener('keydown', function(e) {
            if (!botPreventionPassed) {
                keystrokes.push({
                    key: e.key,
                    time: Date.now()
                });
            }
        });
        
        captchaInput.addEventListener('input', function() {
            validateCaptcha();
        });

        // Refresh button handler
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                const feedback = document.getElementById('captcha-feedback');
                const refreshIcon = document.getElementById('captcha-refresh-icon');
                currentCaptchaText = generateCaptchaText();
                obfuscateCaptchaDisplay(currentCaptchaText);
                captchaStartTime = Date.now();
                mouseMovements = [];
                keystrokes = [];
                botPreventionPassed = false;
                captchaInput.value = '';
                captchaInput.disabled = false;
                captchaInput.className = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent text-center font-mono';
                if (feedback) {
                    feedback.textContent = '';
                    feedback.className = 'mt-2 text-xs font-medium min-h-[1.25rem]';
                }
                // Ensure button visible after manual refresh
                refreshBtn.classList.remove('hidden');
                // Spin icon once
                if (refreshIcon) {
                    refreshIcon.classList.remove('spin-once');
                    // Force reflow to restart animation
                    void refreshIcon.offsetWidth;
                    refreshIcon.classList.add('spin-once');
                }
                updateSubmitButton();
            });
        }
    }
    
    // Check if two strings differ by exactly one case confusion
    function hasOneCaseConfusion(input, expected) {
        if (input.length !== expected.length) return false;
        
        let differences = 0;
        for (let i = 0; i < input.length; i++) {
            if (input[i] !== expected[i]) {
                // Check if it's a case confusion (same letter, different case)
                if (input[i].toLowerCase() !== expected[i].toLowerCase()) {
                    return false; // Not just a case difference
                }
                differences++;
                if (differences > 1) return false; // More than one difference
            }
        }
        
        return differences === 1; // Exactly one case confusion
    }
    
    // Validate human behavior patterns
    function validateCaptcha() {
        const captchaInput = document.getElementById('captcha-input');
        const feedback = document.getElementById('captcha-feedback');
        const refreshBtn = document.getElementById('captcha-refresh');
        
        if (!captchaInput || !feedback) return;
        
        // Detect mobile (touch devices) where mouse movement isn't applicable
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /iPad|iPhone|iPod|Android/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        const userInput = captchaInput.value;
        const timeTaken = Date.now() - captchaStartTime;
        
        // Check if input matches (exact or with one case confusion)
        const isExactMatch = userInput === currentCaptchaText;
        const isCloseMatch = hasOneCaseConfusion(userInput, currentCaptchaText);
        
        if (isExactMatch || isCloseMatch) {
            // Validate human behavior:
            // 1. Must take at least 1.5 seconds (humans can't type instantly)
            // 2. Must have some mouse movement (desktop only)
            // 3. Must have realistic keystroke timing variation (desktop only)
            
            const hasRealisticTiming = timeTaken >= 1200; // slightly relaxed for mobile
            
            // On mobile, skip behavioral checks entirely - just verify timing
            if (isMobile) {
                if (hasRealisticTiming) {
                    botPreventionPassed = true;
                    feedback.textContent = '✓ Verified!';
                    feedback.className = 'mt-2 text-xs font-medium min-h-[1.25rem] text-green-600';
                    captchaInput.disabled = true;
                    captchaInput.className = 'w-full px-3 py-2 border border-green-500 bg-green-50 dark:bg-green-900 dark:text-white rounded-lg text-center font-mono';
                    if (refreshBtn) {
                        refreshBtn.classList.add('hidden');
                    }
                    updateSubmitButton();
                    return;
                } else {
                    // Failed timing validation on mobile
                    feedback.textContent = '✗ Please try again';
                    feedback.className = 'mt-2 text-xs font-medium min-h-[1.25rem] text-red-600';
                    captchaInput.value = '';
                    setTimeout(() => {
                        currentCaptchaText = generateCaptchaText();
                        obfuscateCaptchaDisplay(currentCaptchaText);
                        captchaStartTime = Date.now();
                        mouseMovements = [];
                        keystrokes = [];
                        feedback.textContent = '';
                    }, 2000);
                    return;
                }
            }
            
            // Desktop validation (original logic)
            const hasMouseMovement = mouseMovements.length >= 3;
            
            // Check keystroke timing variance (humans have irregular timing)
            let keystrokeVariance = 0;
            if (keystrokes.length > 2) {
                const intervals = [];
                for (let i = 1; i < keystrokes.length; i++) {
                    intervals.push(keystrokes[i].time - keystrokes[i-1].time);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                keystrokeVariance = intervals.reduce((sum, interval) => 
                    sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
            }
            const hasNaturalTyping = keystrokeVariance > 100 || keystrokes.length < 3;
            
            // Check for unnatural mouse movement patterns (bots move in straight lines)
            let hasNaturalMouseMovement = true;
            if (mouseMovements.length >= 5) {
                // Check if movements are too linear (bot-like)
                let perfectlyVertical = 0;
                let perfectlyHorizontal = 0;
                let totalMoves = 0;
                
                for (let i = 1; i < mouseMovements.length; i++) {
                    const dx = Math.abs(mouseMovements[i].x - mouseMovements[i-1].x);
                    const dy = Math.abs(mouseMovements[i].y - mouseMovements[i-1].y);
                    
                    if (dx > 0 || dy > 0) {
                        totalMoves++;
                        // Check if movement is suspiciously straight
                        if (dx < 2 && dy > 5) perfectlyVertical++;
                        if (dy < 2 && dx > 5) perfectlyHorizontal++;
                    }
                }
                
                // If more than 70% of movements are perfectly straight, likely a bot
                const straightRatio = (perfectlyVertical + perfectlyHorizontal) / totalMoves;
                hasNaturalMouseMovement = straightRatio < 0.7;
            }
            
            if (hasRealisticTiming && hasMouseMovement && hasNaturalTyping && hasNaturalMouseMovement) {
                botPreventionPassed = true;
                feedback.textContent = '✓ Verified!';
                feedback.className = 'mt-2 text-xs font-medium min-h-[1.25rem] text-green-600';
                captchaInput.disabled = true;
                captchaInput.className = 'w-full px-3 py-2 border border-green-500 bg-green-50 dark:bg-green-900 dark:text-white rounded-lg text-center font-mono';
                // Hide the refresh button once authenticated
                if (refreshBtn) {
                    refreshBtn.classList.add('hidden');
                }
                updateSubmitButton();
            } else {
                // Failed validation - seems bot-like
                feedback.textContent = '✗ Please try again naturally';
                feedback.className = 'mt-2 text-xs font-medium min-h-[1.25rem] text-red-600';
                captchaInput.value = '';
                setTimeout(() => {
                    currentCaptchaText = generateCaptchaText();
                    obfuscateCaptchaDisplay(currentCaptchaText);
                    captchaStartTime = Date.now();
                    mouseMovements = [];
                    keystrokes = [];
                    feedback.textContent = '';
                }, 2000);
            }
        } else if (userInput.length >= currentCaptchaText.length) {
            // Wrong answer
            feedback.textContent = '✗ Incorrect, try again';
            feedback.className = 'mt-2 text-xs font-medium min-h-[1.25rem] text-red-600';
            captchaInput.value = '';
            setTimeout(() => {
                currentCaptchaText = generateCaptchaText();
                obfuscateCaptchaDisplay(currentCaptchaText);
                captchaStartTime = Date.now();
                mouseMovements = [];
                keystrokes = [];
                feedback.textContent = '';
                // Ensure refresh button is visible after reset
                if (refreshBtn) {
                    refreshBtn.classList.remove('hidden');
                }
            }, 1500);
        } else {
            feedback.textContent = '';
        }
    }
    
    // Initialize on page load
    initBotPrevention();

    // Mobile-specific: defensively disable autocorrect/capitalization at runtime
    (function() {
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /iPad|iPhone|iPod|Android/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (!isMobile) return;
        const ci = document.getElementById('captcha-input');
        if (ci) {
            ci.setAttribute('autocapitalize', 'off');
            ci.setAttribute('autocorrect', 'off');
            ci.setAttribute('autocomplete', 'off');
            ci.setAttribute('inputmode', 'latin');
        }
    })();

    // Function to update submit button state
    function updateSubmitButton() {
        if (!submitBtn || !gplConfirmContainer || !gplCheckbox) return;
        const isGplVisible = !gplConfirmContainer.classList.contains('hidden');
        const checkboxValid = !isGplVisible || gplCheckbox.checked;
        
        // Checkbox (if visible) AND bot prevention must be passed
        if (checkboxValid && botPreventionPassed) {
            submitBtn.disabled = false;
            submitBtn.className = 'w-full bg-brand-gold text-white py-3 px-6 rounded-lg font-medium hover:bg-opacity-90 transition-colors focus:ring-2 focus:ring-brand-gold focus:ring-offset-2 cursor-pointer';
        } else {
            submitBtn.disabled = true;
            submitBtn.className = 'w-full bg-gray-300 text-gray-500 py-3 px-6 rounded-lg font-medium transition-colors cursor-not-allowed';
        }
    }

    // Enable/disable submit button based on checkbox state
    if (gplCheckbox) {
        gplCheckbox.addEventListener('change', updateSubmitButton);
    }

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const messageDiv = document.getElementById('form-message');
            const originalBtnText = submitBtn.innerHTML;
            
            // Verify bot prevention
            if (!botPreventionPassed) {
                messageDiv.textContent = '✗ Please complete the verification.';
                messageDiv.className = 'text-center text-sm text-red-600 font-medium';
                messageDiv.classList.remove('hidden');
                
                setTimeout(() => {
                    messageDiv.classList.add('hidden');
                }, 5000);
                return;
            }
            
            // Disable submit button and show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="inline-block animate-pulse">Sending...</span>';
            submitBtn.className = 'w-full bg-gray-300 text-gray-500 py-3 px-6 rounded-lg font-medium transition-colors cursor-not-allowed';
            
            // Prepare template parameters
            const isGplVisible = !gplConfirmContainer.classList.contains('hidden');
            const templateParams = {
                reason: document.getElementById('reason').value,
                user_name: document.getElementById('user_name').value,
                user_email: document.getElementById('user_email').value,
                message: document.getElementById('message').value,
                gpl_confirm: isGplVisible && gplCheckbox.checked ? true : null,
                gt_affiliation: document.getElementById('gt_affiliation').value,
                to_email: 'librelinker@gtltc.org'
            };
            
            // Send email using EmailJS
            emailjs.send('service_q1pet98', 'template_dhp34yt', templateParams)
                .then(function(response) {
                    console.log('SUCCESS!', response.status, response.text);
                    messageDiv.textContent = '✓ Message sent successfully! We\'ll get back to you soon.';
                    messageDiv.className = 'text-center text-sm text-green-600 font-medium';
                    messageDiv.classList.remove('hidden');
                    
                    // Reset form
                    document.getElementById('contact-form').reset();
                    gplCheckbox.checked = false;
                    gplConfirmContainer.classList.add('hidden');
                    gplCheckbox.removeAttribute('required');
                    
                    // Reset bot prevention
                    botPreventionPassed = false;
                    document.getElementById('captcha-input').disabled = false;
                    document.getElementById('captcha-input').className = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent text-center font-mono';
                    document.getElementById('captcha-feedback').textContent = '';
                    initBotPrevention();
                    
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.className = 'w-full bg-gray-300 text-gray-500 py-3 px-6 rounded-lg font-medium transition-colors cursor-not-allowed';
                    
                    // Hide success message after 5 seconds
                    setTimeout(() => {
                        messageDiv.classList.add('hidden');
                    }, 5000);
                }, function(error) {
                    console.log('FAILED...', error);
                    messageDiv.textContent = '✗ Failed to send message. Please try again or email us directly at librelinker@gtltc.org';
                    messageDiv.className = 'text-center text-sm text-red-600 font-medium';
                    messageDiv.classList.remove('hidden');
                    
                    // Reset bot prevention and re-enable submit button
                    botPreventionPassed = false;
                    document.getElementById('captcha-input').disabled = false;
                    document.getElementById('captcha-input').className = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent text-center font-mono';
                    document.getElementById('captcha-feedback').textContent = '';
                    initBotPrevention();
                    
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.className = 'w-full bg-brand-gold text-white py-3 px-6 rounded-lg font-medium hover:bg-opacity-90 transition-colors focus:ring-2 focus:ring-brand-gold focus:ring-offset-2 cursor-pointer';
                    
                    // Hide error message after 7 seconds
                    setTimeout(() => {
                        messageDiv.classList.add('hidden');
                    }, 7000);
                });
        });
    }
});
