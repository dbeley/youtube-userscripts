// ==UserScript==
// @name         YouTube Channel - Sort Videos by Views
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Sort YouTube channel videos by view count (all loaded videos)
// @author       dbeley
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[YT Sort by Views] Script loaded');

    // Parse view count from text (supports multiple languages)
    function parseViewCount(text) {
        if (!text) return 0;
        
        const cleaned = text.toLowerCase()
            .replace(/views?|vues?|visualizaciones?|aufrufe?/gi, '')
            .trim();
        
        const match = cleaned.match(/([\d.,]+)\s*([kmb])?/i);
        if (!match) return 0;
        
        let num = parseFloat(match[1].replace(',', '.'));
        const suffix = match[2]?.toUpperCase();
        
        if (suffix === 'K') num *= 1000;
        else if (suffix === 'M') num *= 1000000;
        else if (suffix === 'B') num *= 1000000000;
        
        return Math.floor(num);
    }

    // Extract all videos with their view counts
    function extractVideos() {
        const videos = [];
        const containers = document.querySelectorAll('ytd-rich-item-renderer');
        
        console.log('[YT Sort by Views] Found', containers.length, 'video containers');
        
        containers.forEach((container, index) => {
            try {
                const metadataLine = container.querySelector('#metadata-line');
                if (!metadataLine) return;
                
                const spans = metadataLine.querySelectorAll('span');
                if (spans.length < 1) return;
                
                // Check if first span contains "views" - member-only videos don't show view counts
                const firstSpanText = spans[0]?.textContent?.trim() || '';
                const firstSpanLower = firstSpanText.toLowerCase();
                const hasViewCount = firstSpanLower.includes('view') || firstSpanLower.includes('vue') || 
                                     firstSpanLower.includes('visualizacion') || firstSpanLower.includes('aufruf');
                const viewText = hasViewCount ? firstSpanText : '';
                const views = parseViewCount(viewText);
                
                videos.push({
                    container: container,
                    views: views,
                    viewText: viewText || '(no views - member-only or hidden)'
                });
                
                console.log(`[YT Sort by Views] Video ${index}: ${viewText || '(no views)'} = ${views} views`);
            } catch (error) {
                console.error('[YT Sort by Views] Error parsing video:', error);
            }
        });
        
        console.log('[YT Sort by Views] Extracted', videos.length, 'videos');
        return videos;
    }

    // Sort and re-render videos
    function sortByViews() {
        console.log('[YT Sort by Views] Starting sort...');
        
        const videos = extractVideos();
        
        if (videos.length === 0) {
            console.log('[YT Sort by Views] No videos found');
            alert('No videos found to sort. Make sure you\'re on a channel\'s videos page.');
            return;
        }
        
        // Sort by view count (descending)
        // Videos with 0 views (likely member-only or no view count) go to the end
        videos.sort((a, b) => {
            // If both have 0 views, maintain original order
            if (a.views === 0 && b.views === 0) return 0;
            // If a has 0 views, put it after b
            if (a.views === 0) return 1;
            // If b has 0 views, put it after a
            if (b.views === 0) return -1;
            // Otherwise, sort by view count descending
            return b.views - a.views;
        });
        
        console.log('[YT Sort by Views] Top 5 videos after sorting:');
        videos.slice(0, 5).forEach((v, i) => {
            console.log(`  ${i+1}. ${v.views.toLocaleString()} views`);
        });
        
        // Find parent container
        const gridContainer = videos[0].container.parentElement;
        if (!gridContainer) {
            console.error('[YT Sort by Views] Could not find grid container');
            return;
        }
        
        console.log('[YT Sort by Views] Grid container:', gridContainer.tagName);
        
        // Get all children to preserve structure
        const allChildren = Array.from(gridContainer.children);
        const videoSet = new Set(videos.map(v => v.container));
        
        // Separate videos from other elements
        const videoElements = allChildren.filter(child => videoSet.has(child));
        const otherElements = allChildren.filter(child => !videoSet.has(child));
        
        console.log('[YT Sort by Views] Videos:', videoElements.length);
        console.log('[YT Sort by Views] Other elements:', otherElements.length);
        
        // Clear and rebuild
        gridContainer.innerHTML = '';
        
        // Add sorted videos
        videos.forEach(v => {
            gridContainer.appendChild(v.container);
        });
        
        // Add back other elements at the end
        otherElements.forEach(el => {
            gridContainer.appendChild(el);
        });
        
        console.log('[YT Sort by Views] ✓ Videos re-sorted!');
        
        // Show notification
        showNotification(`Sorted ${videos.length} videos by view count!`);
    }

    // Show a temporary notification
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #0f0f0f;
            color: #fff;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            z-index: 10000;
            font-size: 14px;
            font-family: "Roboto", sans-serif;
            animation: slideIn 0.3s ease;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Create the sort button
    function createButton() {
        const chipBar = document.querySelector('#chips');
        if (!chipBar) {
            console.log('[YT Sort by Views] Chip bar not found, will retry...');
            return false;
        }
        
        // Remove existing button if it exists (for SPA navigation)
        const existingButton = document.querySelector('#sort-by-views-btn');
        if (existingButton) {
            console.log('[YT Sort by Views] Removing existing button');
            existingButton.remove();
        }
        
        const button = document.createElement('button');
        button.id = 'sort-by-views-btn';
        button.innerHTML = '📊 Sort by Views';
        button.style.cssText = `
            padding: 8px 16px;
            margin-left: 12px;
            background: #3ea6ff;
            color: white;
            border: none;
            border-radius: 18px;
            font-size: 14px;
            font-weight: 500;
            font-family: "Roboto", sans-serif;
            cursor: pointer;
            transition: background 0.2s;
            flex-shrink: 0;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.background = '#3091e0';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.background = '#3ea6ff';
        });
        
        button.addEventListener('click', () => {
            button.disabled = true;
            button.textContent = '⏳ Sorting...';
            
            setTimeout(() => {
                sortByViews();
                button.disabled = false;
                button.innerHTML = '📊 Sort by Views';
            }, 100);
        });
        
        // Find the container div that holds left-arrow, scroll-container, and right-arrow
        // Insert the button after scroll-container but before right-arrow
        const scrollContainer = chipBar.parentElement; // This is #scroll-container
        const containerDiv = scrollContainer.parentElement; // This is #container
        const rightArrow = containerDiv.querySelector('#right-arrow');
        
        if (rightArrow) {
            // Insert button before the right arrow
            containerDiv.insertBefore(button, rightArrow);
        } else {
            // Fallback: append to container
            containerDiv.appendChild(button);
        }
        
        console.log('[YT Sort by Views] Button created');
        return true;
    }

    // Check if we're on a channel videos page
    function isChannelPage() {
        return window.location.pathname.includes('/@') || 
               window.location.pathname.includes('/channel/') ||
               window.location.pathname.includes('/c/') ||
               window.location.pathname.includes('/user/');
    }

    // Initialize
    function init() {
        if (!isChannelPage()) {
            console.log('[YT Sort by Views] Not on a channel page');
            return;
        }
        
        console.log('[YT Sort by Views] Initializing...');
        
        // Wait for page to load
        let attempts = 0;
        const maxAttempts = 20;
        
        const interval = setInterval(() => {
            attempts++;
            
            if (createButton()) {
                clearInterval(interval);
                console.log('[YT Sort by Views] ✓ Ready!');
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.log('[YT Sort by Views] Could not find chip bar after', maxAttempts, 'attempts');
            }
        }, 500);
    }

    // Run on load
    init();
    
    // Re-run on navigation (YouTube SPA)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('[YT Sort by Views] URL changed to:', url);
            // Remove old button immediately on navigation
            const existingButton = document.querySelector('#sort-by-views-btn');
            if (existingButton) {
                existingButton.remove();
            }
            // Re-initialize after a short delay
            setTimeout(init, 500);
        }
    }).observe(document, { subtree: true, childList: true });

    // Expose debug function
    window.ytSortDebug = {
        sort: sortByViews,
        extract: extractVideos
    };

})();
