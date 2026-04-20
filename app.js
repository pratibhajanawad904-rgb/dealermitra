document.addEventListener('DOMContentLoaded', () => {
    // Tab Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const screens = document.querySelectorAll('.screen');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all nav items and hide all screens
            navItems.forEach(nav => nav.classList.remove('active'));
            screens.forEach(screen => {
                screen.classList.remove('active');
                screen.classList.add('hidden');
            });

            // Add active class to clicked nav item
            item.classList.add('active');

            // Show corresponding screen
            const targetId = item.getAttribute('data-target');
            const targetScreen = document.getElementById(targetId);
            if (targetScreen) {
                targetScreen.classList.remove('hidden');
                targetScreen.classList.add('active');
            }
            
            if (targetId === 'screen-orders') {
                loadAIBundles();
            }
        });
    });

    // Quick Order - Bulk Add to Cart Logic
    const qtyInputs = document.querySelectorAll('.qty-input');
    const bulkBtn = document.querySelector('.bulk-btn');

    qtyInputs.forEach(input => {
        input.addEventListener('input', () => {
            let totalItems = 0;
            qtyInputs.forEach(inp => {
                const val = parseInt(inp.value) || 0;
                if (val > 0) totalItems++;
            });
            bulkBtn.textContent = `Add All to Cart (${totalItems} items)`;
        });
    });

    bulkBtn.addEventListener('click', async () => {
        const items = [];
        qtyInputs.forEach(inp => {
            const qty = parseInt(inp.value) || 0;
            if (qty > 0) {
                const row = inp.closest('.ss-row');
                const productName = row.querySelector('.col-product span').textContent;
                items.push({ product: productName, quantity: qty });
            }
        });

        if (items.length === 0) {
            alert('Please enter quantities before adding to cart.');
            return;
        }

        try {
            bulkBtn.textContent = 'Processing...';
            bulkBtn.disabled = true;

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                alert(`Order created successfully! Order ID: ${data.order_id}`);
                qtyInputs.forEach(inp => inp.value = 0);
                bulkBtn.textContent = `Add All to Cart (0 items)`;
            } else {
                alert('Error creating order: ' + data.message);
                bulkBtn.textContent = `Add All to Cart (${items.length} items)`;
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to connect to the server.');
            bulkBtn.textContent = `Add All to Cart (${items.length} items)`;
        } finally {
            bulkBtn.disabled = false;
        }
    });

    // Knowledge Card Modal Logic
    const modalOverlay = document.getElementById('knowledge-modal');
    const viewSpecsBtns = document.querySelectorAll('.view-specs-btn');
    const closeModalBtn = document.querySelector('.close-modal');

    // Sample data mapping for the demo
    const productData = {
        omax: { title: "O-MAX", dosage: "2kg per acre", soil: "All soil types (ideal for pH 6.5 - 7.5)", yield: "+15% grain weight" },
        humate: { title: "Humate Power", dosage: "500ml per acre", soil: "Sandy or depleted soils", yield: "Improved root mass by 20%" },
        bramha: { title: "Bramha-Zyme", dosage: "1kg per acre", soil: "Clay or heavy soils", yield: "+10% crop vigor in early stages" },
        neo: { title: "Neo-20", dosage: "5kg per acre", soil: "Alkaline soils", yield: "Corrects Zinc deficiency in 14 days" }
    };

    viewSpecsBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const prodKey = btn.getAttribute('data-product');
            const data = productData[prodKey];
            
            if (data) {
                document.querySelector('.modal-product-title').textContent = data.title;
                const pTags = document.querySelectorAll('.modal-body p');
                pTags[0].textContent = data.dosage;
                pTags[1].textContent = data.soil;
                pTags[2].textContent = data.yield;
            }
            
            modalOverlay.classList.remove('hidden');
        });
    });

    closeModalBtn.addEventListener('click', () => {
        modalOverlay.classList.add('hidden');
    });

    // Close modal if clicking outside the content
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.add('hidden');
        }
    });

    // Clone Order Toast Logic
    const cloneBtns = document.querySelectorAll('.clone-btn');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastAction = document.querySelector('.toast-action');
    let toastTimeout;

    cloneBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const orderNum = btn.getAttribute('data-order');
            toastMessage.textContent = `Order #${orderNum} added to cart. Modify quantities?`;
            
            toast.classList.remove('hidden');
            
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toast.classList.add('hidden');
            }, 5000);
        });
    });

    toastAction.addEventListener('click', () => {
        toast.classList.add('hidden');
        // In a real app, this would navigate to the cart
        alert('Navigating to cart...');
    });

    // AI Bundles Loading Logic
    let aiBundlesLoaded = false;
    async function loadAIBundles() {
        if (aiBundlesLoaded) return;
        
        const container = document.getElementById('ai-bundle-list');
        if (!container) return;

        try {
            const response = await fetch('/api/bundles/recommendations');
            const result = await response.json();
            
            if (result.status === 'success') {
                container.innerHTML = ''; // Clear loading text
                
                result.data.forEach(bundle => {
                    const html = `
                        <div class="card bundle-card">
                            <div class="bundle-info">
                                <h3>${bundle.title}</h3>
                                <p>${bundle.description}</p>
                            </div>
                            <button class="btn-secondary add-bundle-btn">Add Bundle</button>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', html);
                });
                aiBundlesLoaded = true;
            } else {
                container.innerHTML = `<p style="font-size:13px; color:var(--traffic-red); text-align:center; padding: 20px;">Failed to load AI recommendations.</p>`;
            }
        } catch (error) {
            console.error('Failed to load AI bundles:', error);
            container.innerHTML = `<p style="font-size:13px; color:var(--traffic-red); text-align:center; padding: 20px;">Server connection failed.</p>`;
        }
    }

    // Dashboard AI Briefing Logic
    async function loadDashboardBriefing() {
        const textElement = document.getElementById('ai-briefing-text');
        if (!textElement) return;

        try {
            const response = await fetch('/api/dashboard/briefing');
            const result = await response.json();
            
            if (result.status === 'success') {
                textElement.textContent = result.briefing;
            } else {
                textElement.textContent = "Unable to load business brief at this time.";
            }
        } catch (error) {
            console.error('Failed to load briefing:', error);
            textElement.textContent = "Offline: Check your server connection.";
        }
    }

    // Credit Chart Animation Logic
    function animateCreditChart() {
        const ring = document.getElementById('credit-progress-ring');
        if (!ring) return;
        
        // Use setTimeout to ensure the browser has rendered the SVG before animating
        setTimeout(() => {
            ring.style.transition = 'stroke-dasharray 1.5s ease-in-out';
            ring.style.strokeDasharray = '24, 100';
        }, 300);
    }

    // Initialize Dashboard on load
    loadDashboardBriefing();
    animateCreditChart();
});
