// XRPL Playground
// Main application logic
// Version 2.3.2 - Updated branding to "Playground"

// Global state
let definitions = null;
let transactions = [];  // Array of transaction objects
let currentTransactionId = null;  // Active transaction being edited
let draggedData = null;
let currentNetwork = 'testnet';
let accounts = [];
let nextTransactionNumber = 1;  // For auto-naming transactions

// Legacy support (will be migrated)
let workspaceBlocks = [];
let transactionType = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadDefinitions();

    // Load from local storage
    const hasStoredTests = loadTestsFromStorage();
    const hasStoredAccounts = loadAccountsFromStorage();
    const hasStoredNetwork = loadNetworkFromStorage();

    // Create first transaction if no stored tests
    if (!hasStoredTests) {
        addTransaction('Test 1');
    }

    // Update network selector UI if network was loaded from storage
    if (hasStoredNetwork) {
        document.getElementById('network-select').value = currentNetwork;
    }

    initializePalette();
    initializeEventListeners();
    initializeKeyboardShortcuts();
    initializeNetworkManagement();
    renderWorkspace();
    updateCurrentTestLabel();
    updateJSONOutput();

    // Render accounts if they were loaded from storage
    if (hasStoredAccounts) {
        renderAccounts();
    }

    // Show toast if data was loaded
    if (hasStoredTests || hasStoredAccounts) {
        const items = [];
        if (hasStoredTests) items.push(`${transactions.length} test(s)`);
        if (hasStoredAccounts) items.push(`${accounts.length} account(s)`);
        showToast(`💾 Loaded ${items.join(' and ')} from local storage`, 'success', 3000);
    }
});

// Load definitions.json
async function loadDefinitions() {
    try {
        const response = await fetch('definitions.json');
        definitions = await response.json();
        console.log('Definitions loaded:', definitions);
    } catch (error) {
        console.error('Error loading definitions:', error);
        showValidationMessage('Failed to load definitions.json', 'error');
    }
}

// Transaction Management Functions
function generateTransactionId() {
    return 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function createTransaction(name = null) {
    const id = generateTransactionId();
    const transactionName = name || `Test ${nextTransactionNumber}`;
    nextTransactionNumber++;

    return {
        id: id,
        name: transactionName,
        type: null,  // TransactionType
        blocks: [],  // Field blocks
        status: 'pending',  // pending | running | passed | failed
        expectedResult: 'tesSUCCESS',
        actualResult: null,
        submittedAt: null,
        hash: null
    };
}

function addTransaction(name = null) {
    const transaction = createTransaction(name);
    transactions.push(transaction);
    currentTransactionId = transaction.id;
    return transaction;
}

function removeTransaction(id) {
    const index = transactions.findIndex(tx => tx.id === id);
    if (index === -1) return;

    transactions.splice(index, 1);

    // Update current transaction ID
    if (currentTransactionId === id) {
        if (transactions.length > 0) {
            currentTransactionId = transactions[0].id;
        } else {
            currentTransactionId = null;
        }
    }

    saveTestsToStorage();
}

function getCurrentTransaction() {
    if (!currentTransactionId) return null;
    return transactions.find(tx => tx.id === currentTransactionId);
}

function updateTransactionStatus(id, status, result = null) {
    const transaction = transactions.find(tx => tx.id === id);
    if (!transaction) return;

    transaction.status = status;
    if (result !== null) {
        transaction.actualResult = result;
    }
    if (status === 'running') {
        transaction.submittedAt = new Date().toISOString();
    }
}

function updateTransactionHash(id, hash) {
    const transaction = transactions.find(tx => tx.id === id);
    if (transaction) {
        transaction.hash = hash;
    }
}

function updateTransactionTypeSectionVisibility() {
    const currentTx = getCurrentTransaction();
    const txTypeSection = document.getElementById('transaction-type-section');
    const fieldsSection = document.getElementById('fields-section');

    if (!txTypeSection || !fieldsSection) return;

    // Show transaction type section if current transaction has no type
    if (currentTx && !currentTx.type) {
        txTypeSection.style.display = '';
        fieldsSection.style.display = 'none';
    } else if (currentTx && currentTx.type) {
        txTypeSection.style.display = 'none';
        fieldsSection.style.display = '';
    }
}

// Transaction UI Rendering
function renderWorkspace() {
    const workspace = document.getElementById('workspace');
    workspace.innerHTML = '';

    if (transactions.length === 0) {
        showWorkspacePlaceholder();
        renderTestQueue();
        return;
    }

    // Render only the current/active transaction in the workspace
    const currentTx = getCurrentTransaction();
    if (currentTx) {
        renderActiveTransaction(currentTx);
    } else {
        showWorkspacePlaceholder();
    }

    // Render all transactions in the test queue
    renderTestQueue();
}

function renderActiveTransaction(transaction) {
    const workspace = document.getElementById('workspace');
    workspace.innerHTML = '';

    // Create a simple container for the active transaction (no card wrapper)
    const container = document.createElement('div');
    container.className = 'active-transaction';
    container.id = `transaction-body-${transaction.id}`;

    // Render blocks for this transaction
    if (transaction.type) {
        const typeBlock = createWorkspaceBlock('TransactionType', 'transaction-type', transaction.type, true);
        container.appendChild(typeBlock);
    }

    transaction.blocks.forEach(block => {
        const fieldInfo = getFieldInfo(block.fieldName);
        const blockType = fieldInfo ? getBlockTypeForField(fieldInfo) : 'common-field';
        const blockElement = createWorkspaceBlock(block.fieldName, blockType, block.value, false);
        container.appendChild(blockElement);
    });

    if (!transaction.type && transaction.blocks.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'workspace-placeholder';
        placeholder.innerHTML = '<p>👆 Drag blocks here to build this transaction</p><p class="hint">Start with a Transaction Type block</p>';
        container.appendChild(placeholder);
    }

    workspace.appendChild(container);
}

function renderTestQueue() {
    // Render in the right panel
    const queueContainer = document.getElementById('test-queue-right');
    if (!queueContainer) {
        console.error('Test queue container not found!');
        return;
    }

    console.log('Rendering test queue with', transactions.length, 'transactions');
    queueContainer.innerHTML = '';

    if (transactions.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'test-queue-empty';
        emptyMsg.textContent = 'No tests yet. Click "Add Test" to create one.';
        emptyMsg.style.color = '#999';
        emptyMsg.style.fontStyle = 'italic';
        emptyMsg.style.padding = '1rem';
        emptyMsg.style.textAlign = 'center';
        queueContainer.appendChild(emptyMsg);
        return;
    }

    transactions.forEach((transaction, index) => {
        console.log('Creating queue item for:', transaction.name);
        const queueItem = createTestQueueItem(transaction, index + 1);
        queueContainer.appendChild(queueItem);
    });
}

function createTestQueueItem(transaction, number) {
    const item = document.createElement('div');
    item.className = `test-queue-item status-${transaction.status}`;
    item.dataset.transactionId = transaction.id;

    // Highlight if this is the current transaction
    if (transaction.id === currentTransactionId) {
        item.classList.add('active');
    }

    // Number
    const numSpan = document.createElement('span');
    numSpan.className = 'test-queue-number';
    numSpan.textContent = `${number}.`;

    // Status icon
    const statusSpan = document.createElement('span');
    statusSpan.className = 'test-queue-status';
    statusSpan.textContent = getStatusIcon(transaction.status);

    // Name (editable on double-click)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'test-queue-name';
    nameSpan.textContent = transaction.name;
    nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = transaction.name;
        input.className = 'test-queue-name-edit';
        input.style.flex = '1';
        input.style.border = '1px solid var(--primary-color)';
        input.style.padding = '0.25rem';
        input.style.borderRadius = '4px';

        const save = () => {
            transaction.name = input.value || transaction.name;
            nameSpan.textContent = transaction.name;
            nameSpan.style.display = '';
            input.remove();
            updateCurrentTestLabel();
            saveTestsToStorage();
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
                nameSpan.style.display = '';
                input.remove();
            }
        });

        nameSpan.style.display = 'none';
        nameSpan.parentElement.insertBefore(input, nameSpan.nextSibling);
        input.focus();
        input.select();
    });

    // Transaction type badge
    const typeSpan = document.createElement('span');
    typeSpan.className = 'test-queue-type';
    typeSpan.textContent = transaction.type || 'No type';

    // Expected result selector
    const expectedResultDiv = document.createElement('div');
    expectedResultDiv.className = 'test-queue-expected';

    const expectedLabel = document.createElement('span');
    expectedLabel.textContent = 'Expect:';
    expectedLabel.style.fontSize = '0.75rem';
    expectedLabel.style.color = '#666';
    expectedLabel.style.marginRight = '0.25rem';

    const expectedSelect = document.createElement('select');
    expectedSelect.className = 'test-queue-expected-select';
    expectedSelect.innerHTML = `
        <option value="tesSUCCESS" ${transaction.expectedResult === 'tesSUCCESS' ? 'selected' : ''}>tesSUCCESS</option>
        <option value="tecNO_DST" ${transaction.expectedResult === 'tecNO_DST' ? 'selected' : ''}>tecNO_DST</option>
        <option value="tecUNFUNDED_PAYMENT" ${transaction.expectedResult === 'tecUNFUNDED_PAYMENT' ? 'selected' : ''}>tecUNFUNDED_PAYMENT</option>
        <option value="tecNO_PERMISSION" ${transaction.expectedResult === 'tecNO_PERMISSION' ? 'selected' : ''}>tecNO_PERMISSION</option>
        <option value="temBAD_FEE" ${transaction.expectedResult === 'temBAD_FEE' ? 'selected' : ''}>temBAD_FEE</option>
        <option value="tefPAST_SEQ" ${transaction.expectedResult === 'tefPAST_SEQ' ? 'selected' : ''}>tefPAST_SEQ</option>
    `;
    expectedSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        transaction.expectedResult = e.target.value;
        saveTestsToStorage();
    });

    expectedResultDiv.appendChild(expectedLabel);
    expectedResultDiv.appendChild(expectedSelect);

    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'test-queue-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'test-queue-btn';
    editBtn.textContent = transaction.id === currentTransactionId ? 'Editing' : 'Edit';
    editBtn.disabled = transaction.id === currentTransactionId;
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        switchToTransaction(transaction.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'test-queue-btn delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete test';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${transaction.name}"?`)) {
            removeTransaction(transaction.id);
            renderWorkspace();
            updateTransactionTypeSectionVisibility();
            updateJSONOutput();
        }
    });

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    // Click on item to edit
    item.addEventListener('click', () => {
        if (transaction.id !== currentTransactionId) {
            switchToTransaction(transaction.id);
        }
    });

    item.appendChild(numSpan);
    item.appendChild(statusSpan);
    item.appendChild(nameSpan);
    item.appendChild(typeSpan);
    item.appendChild(expectedResultDiv);
    item.appendChild(actionsDiv);

    return item;
}

function switchToTransaction(transactionId) {
    currentTransactionId = transactionId;

    // Get the transaction we're switching to
    const transaction = getCurrentTransaction();

    renderWorkspace();
    updateTransactionTypeSectionVisibility();

    // If the transaction has a type, show the fields for that type
    if (transaction && transaction.type) {
        showFieldsForTransactionType(transaction.type);
    }

    updateCurrentTestLabel();
    updateJSONOutput();
    saveTestsToStorage();
}

function updateCurrentTestLabel() {
    const label = document.getElementById('current-test-label');
    if (!label) return;

    const currentTx = getCurrentTransaction();
    if (currentTx) {
        label.textContent = `Editing: ${currentTx.name}`;
        label.style.display = '';
    } else {
        label.style.display = 'none';
    }
}

function getStatusIcon(status) {
    const icons = {
        pending: '⏸️',
        running: '⏳',
        passed: '✅',
        failed: '❌'
    };
    return icons[status] || '⏸️';
}

function getStatusText(status) {
    const texts = {
        pending: 'Pending',
        running: 'Running',
        passed: 'Passed',
        failed: 'Failed'
    };
    return texts[status] || 'Pending';
}

function handleAddTest() {
    const newTransaction = addTransaction();
    renderWorkspace();
    updateTransactionTypeSectionVisibility();
    updateCurrentTestLabel();
    updateJSONOutput();
    saveTestsToStorage();
    showMessage(`✅ Added "${newTransaction.name}"`, 'success');
}

async function runAllTests() {
    showToast('🚀 Running all tests...', 'info', 3000);

    // Reset all test statuses
    transactions.forEach(tx => {
        tx.status = 'pending';
        tx.actualResult = null;
        tx.hash = null;
        tx.submittedAt = null;
    });
    renderTestQueue();

    for (const transaction of transactions) {
        await runSingleTest(transaction.id);
    }

    // Show summary
    const passed = transactions.filter(tx => tx.status === 'passed').length;
    const failed = transactions.filter(tx => tx.status === 'failed').length;
    const total = transactions.length;

    renderTestResultsSummary();

    if (failed === 0) {
        showToast(`✅ All tests passed! (${passed}/${total})`, 'success', 5000);
    } else {
        showToast(`⚠️ Tests complete: ${passed} passed, ${failed} failed (${total} total)`, 'warning', 7000);
    }
}

async function runCurrentTest() {
    const currentTx = getCurrentTransaction();
    if (!currentTx) {
        showMessage('⚠️ No test selected', 'warning');
        return;
    }
    await runSingleTest(currentTx.id);
}

async function runSingleTest(transactionId) {
    const transaction = transactions.find(tx => tx.id === transactionId);
    if (!transaction) {
        showToast('❌ Test not found', 'error');
        return;
    }

    // Check if transaction has a type
    if (!transaction.type) {
        showToast(`❌ ${transaction.name}: No transaction type set`, 'error');
        updateTransactionStatus(transactionId, 'failed', 'No transaction type');
        renderTestQueue();
        saveTestsToStorage();
        return;
    }

    // Build transaction object from blocks
    const txObject = buildTransactionObjectFromTest(transaction);

    // Check if we have an account with a seed
    const signingAccount = accounts.find(acc => acc.seed);
    if (!signingAccount) {
        showToast('❌ No account with signing key available. Generate an account first.', 'error');
        updateTransactionStatus(transactionId, 'failed', 'No signing account');
        renderTestQueue();
        saveTestsToStorage();
        return;
    }

    // Get network endpoint
    const networks = {
        mainnet: 'wss://xrplcluster.com',
        testnet: 'wss://s.altnet.rippletest.net:51233',
        devnet: 'wss://s.devnet.rippletest.net:51233'
    };

    const endpoint = networks[currentNetwork];

    try {
        // Update status to running
        updateTransactionStatus(transactionId, 'running');
        renderTestQueue();
        saveTestsToStorage();

        showToast(`🔄 Running: ${transaction.name}`, 'info', 3000);

        const client = new xrpl.Client(endpoint);
        await client.connect();

        // Create wallet from seed
        const wallet = xrpl.Wallet.fromSeed(signingAccount.seed);

        // Auto-fill Account field if not set
        if (!txObject.Account) {
            txObject.Account = wallet.address;
        }

        // Submit and wait for validation
        const result = await client.submitAndWait(txObject, {
            autofill: true,
            wallet: wallet
        });

        await client.disconnect();

        const actualResult = result.result.meta.TransactionResult;
        const hash = result.result.hash;

        // Update transaction with results
        transaction.actualResult = actualResult;
        transaction.hash = hash;
        transaction.submittedAt = new Date().toISOString();

        // Determine pass/fail
        if (actualResult === transaction.expectedResult) {
            updateTransactionStatus(transactionId, 'passed', actualResult);
            const explorerUrl = getExplorerUrl(hash, currentNetwork);
            showToast(`✅ ${transaction.name}: ${actualResult}`, 'success', 5000, {
                text: 'View in Explorer',
                url: explorerUrl
            });
        } else {
            updateTransactionStatus(transactionId, 'failed', actualResult);
            showToast(`❌ ${transaction.name}: Expected ${transaction.expectedResult}, got ${actualResult}`, 'error', 7000);
        }

        renderTestQueue();
        saveTestsToStorage();

    } catch (error) {
        updateTransactionStatus(transactionId, 'failed', error.message);
        showToast(`❌ ${transaction.name}: ${error.message}`, 'error', 7000);
        renderTestQueue();
        saveTestsToStorage();
        console.error('Test execution error:', error);
    }
}

function buildTransactionObjectFromTest(transaction) {
    const txObject = {
        TransactionType: transaction.type
    };

    // Add all blocks
    transaction.blocks.forEach(block => {
        try {
            // Try to parse as JSON for complex fields
            const parsed = JSON.parse(block.value);
            txObject[block.fieldName] = parsed;
        } catch {
            // Use as string if not valid JSON
            txObject[block.fieldName] = block.value;
        }
    });

    return txObject;
}

// Test Results & Reporting
function renderTestResultsSummary() {
    const summaryContainer = document.getElementById('test-results-summary');
    const downloadBtn = document.getElementById('download-report-btn');

    if (!summaryContainer) return;

    // Check if any tests have been run
    const hasResults = transactions.some(tx => tx.status === 'passed' || tx.status === 'failed');

    if (!hasResults) {
        summaryContainer.style.display = 'none';
        downloadBtn.style.display = 'none';
        return;
    }

    summaryContainer.style.display = 'block';
    downloadBtn.style.display = 'inline-block';

    const passed = transactions.filter(tx => tx.status === 'passed').length;
    const failed = transactions.filter(tx => tx.status === 'failed').length;
    const total = transactions.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    summaryContainer.innerHTML = `
        <h3>Test Results</h3>
        <div class="results-stats">
            <div class="result-stat">
                <div class="result-stat-value total">${total}</div>
                <div class="result-stat-label">Total</div>
            </div>
            <div class="result-stat">
                <div class="result-stat-value passed">${passed}</div>
                <div class="result-stat-label">Passed</div>
            </div>
            <div class="result-stat">
                <div class="result-stat-value failed">${failed}</div>
                <div class="result-stat-label">Failed</div>
            </div>
            <div class="result-stat">
                <div class="result-stat-value ${passRate === 100 ? 'passed' : 'total'}">${passRate}%</div>
                <div class="result-stat-label">Pass Rate</div>
            </div>
        </div>
        <div class="results-details">
            ${transactions.map(tx => {
                if (tx.status !== 'passed' && tx.status !== 'failed') return '';

                const explorerUrl = tx.hash ? getExplorerUrl(tx.hash, currentNetwork) : null;

                return `
                    <div class="result-item ${tx.status}">
                        <div class="result-item-name">
                            ${tx.status === 'passed' ? '✅' : '❌'} ${tx.name}
                        </div>
                        <div class="result-item-result">${tx.actualResult || 'N/A'}</div>
                        ${explorerUrl ? `<div class="result-item-link"><a href="${explorerUrl}" target="_blank" rel="noopener noreferrer">View →</a></div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function downloadTestReport() {
    // Show the download format modal
    showDownloadReportModal();
}

function showDownloadReportModal() {
    const modal = document.getElementById('download-report-modal');
    modal.classList.add('show');
}

function hideDownloadReportModal() {
    const modal = document.getElementById('download-report-modal');
    modal.classList.remove('show');
}

function downloadTestReportJSON() {
    const passed = transactions.filter(tx => tx.status === 'passed').length;
    const failed = transactions.filter(tx => tx.status === 'failed').length;
    const total = transactions.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const report = {
        metadata: {
            generatedAt: new Date().toISOString(),
            network: currentNetwork,
            totalTests: total,
            passed: passed,
            failed: failed,
            passRate: `${passRate}%`
        },
        tests: transactions.map(tx => ({
            name: tx.name,
            type: tx.type,
            status: tx.status,
            expectedResult: tx.expectedResult,
            actualResult: tx.actualResult,
            hash: tx.hash,
            submittedAt: tx.submittedAt,
            explorerUrl: tx.hash ? getExplorerUrl(tx.hash, currentNetwork) : null,
            transaction: buildTransactionObjectFromTest(tx)
        }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xrpl-test-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    hideDownloadReportModal();
    showToast('📥 JSON report downloaded', 'success', 3000);
}

function downloadTestReportMarkdown() {
    const passed = transactions.filter(tx => tx.status === 'passed').length;
    const failed = transactions.filter(tx => tx.status === 'failed').length;
    const total = transactions.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString();

    let markdown = `# XRPL Test Report\n\n`;
    markdown += `**Generated:** ${date} at ${time}  \n`;
    markdown += `**Network:** ${currentNetwork.charAt(0).toUpperCase() + currentNetwork.slice(1)}  \n\n`;

    markdown += `## Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Tests | ${total} |\n`;
    markdown += `| Passed | ✅ ${passed} |\n`;
    markdown += `| Failed | ❌ ${failed} |\n`;
    markdown += `| Pass Rate | ${passRate}% |\n\n`;

    markdown += `## Test Results\n\n`;

    transactions.forEach((tx, index) => {
        if (tx.status !== 'passed' && tx.status !== 'failed') return;

        const statusIcon = tx.status === 'passed' ? '✅' : '❌';
        markdown += `### ${index + 1}. ${statusIcon} ${tx.name}\n\n`;
        markdown += `- **Type:** ${tx.type || 'N/A'}\n`;
        markdown += `- **Status:** ${tx.status}\n`;
        markdown += `- **Expected Result:** \`${tx.expectedResult}\`\n`;
        markdown += `- **Actual Result:** \`${tx.actualResult || 'N/A'}\`\n`;

        if (tx.hash) {
            const explorerUrl = getExplorerUrl(tx.hash, currentNetwork);
            markdown += `- **Transaction Hash:** \`${tx.hash}\`\n`;
            markdown += `- **Explorer:** [View Transaction](${explorerUrl})\n`;
        }

        if (tx.submittedAt) {
            markdown += `- **Submitted At:** ${new Date(tx.submittedAt).toLocaleString()}\n`;
        }

        markdown += `\n`;

        // Add transaction details
        const txObject = buildTransactionObjectFromTest(tx);
        markdown += `**Transaction Details:**\n\n`;
        markdown += `\`\`\`json\n`;
        markdown += JSON.stringify(txObject, null, 2);
        markdown += `\n\`\`\`\n\n`;
    });

    markdown += `---\n\n`;
    markdown += `*Generated by XRPL Playground*\n`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xrpl-test-report-${date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    hideDownloadReportModal();
    showToast('📥 Markdown report downloaded', 'success', 3000);
}

// JSON Modal Functions
function showJSONModal() {
    const modal = document.getElementById('json-modal');
    modal.classList.add('show');
    updateJSONOutput(); // Refresh JSON before showing
}

function hideJSONModal() {
    const modal = document.getElementById('json-modal');
    modal.classList.remove('show');
}

// Initialize block palette
function initializePalette() {
    if (!definitions) return;

    // Generate transaction type blocks only
    generateTransactionTypeBlocks();
    // Fields will be generated after transaction type is selected
}

// Generate transaction type blocks
function generateTransactionTypeBlocks() {
    const container = document.getElementById('transaction-types-palette');
    const types = definitions.TRANSACTION_TYPES;

    // Filter out invalid types and sort alphabetically
    const validTypes = Object.entries(types)
        .filter(([name, value]) => value >= 0)
        .sort((a, b) => a[0].localeCompare(b[0]));

    validTypes.forEach(([typeName, typeValue]) => {
        const block = createPaletteBlock(typeName, 'transaction-type', 'TransactionType');
        // Store the actual transaction type name in a data attribute
        block.dataset.transactionType = typeName;
        container.appendChild(block);
    });
}

// Generate field blocks organized by type
function generateFieldBlocks() {
    const fields = definitions.FIELDS;
    
    // Categorize fields
    const categories = {
        common: ['Account', 'Fee', 'Sequence', 'LastLedgerSequence', 'SigningPubKey'],
        account: [],
        amount: [],
        number: [],
        hash: [],
        blob: []
    };
    
    fields.forEach(([fieldName, fieldInfo]) => {
        if (!fieldInfo.isSerialized) return;
        
        const type = fieldInfo.type;
        
        // Skip if already in common
        if (categories.common.includes(fieldName)) return;
        
        // Categorize by type
        if (type === 'AccountID') {
            categories.account.push(fieldName);
        } else if (type === 'Amount') {
            categories.amount.push(fieldName);
        } else if (type.startsWith('UInt') || type === 'Number') {
            categories.number.push(fieldName);
        } else if (type.startsWith('Hash')) {
            categories.hash.push(fieldName);
        } else if (type === 'Blob') {
            categories.blob.push(fieldName);
        }
    });
    
    // Populate common fields
    populateFieldCategory('common-fields', categories.common, 'common-field');
    
    // Populate categorized fields
    populateFieldCategory('account-fields', categories.account.sort(), 'account-field');
    populateFieldCategory('amount-fields', categories.amount.sort(), 'amount-field');
    populateFieldCategory('number-fields', categories.number.sort(), 'number-field');
    populateFieldCategory('hash-fields', categories.hash.sort(), 'hash-field');
    populateFieldCategory('blob-fields', categories.blob.sort(), 'blob-field');
}

// Populate a field category
function populateFieldCategory(containerId, fields, blockClass) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    fields.forEach(fieldName => {
        const block = createPaletteBlock(fieldName, blockClass, fieldName);
        container.appendChild(block);
    });
}

// Create a palette block element
function createPaletteBlock(label, className, fieldName) {
    const block = document.createElement('div');
    block.className = `block ${className}`;
    block.textContent = label;
    block.draggable = true;
    block.dataset.fieldName = fieldName;
    block.dataset.blockType = className;

    // Add tooltip with field type information
    const fieldInfo = getFieldInfo(fieldName);
    if (fieldInfo) {
        block.title = `Type: ${fieldInfo.type}${fieldInfo.isSigningField ? ' (Signing Field)' : ''}`;
    }

    // Add drag event listeners
    block.addEventListener('dragstart', handleDragStart);

    return block;
}

// Setup collapsible categories
function setupCollapsibleCategories() {
    const categories = document.querySelectorAll('.palette-category.collapsible');
    
    categories.forEach(category => {
        category.addEventListener('click', () => {
            const targetId = category.dataset.target;
            const target = document.getElementById(targetId);
            
            if (target) {
                target.classList.toggle('collapsed');
                category.classList.toggle('collapsed');
            }
        });
    });
}

// Initialize event listeners
function initializeEventListeners() {
    const workspace = document.getElementById('workspace');
    
    // Workspace drag and drop
    workspace.addEventListener('dragover', handleDragOver);
    workspace.addEventListener('drop', handleDrop);
    workspace.addEventListener('dragleave', handleDragLeave);
    
    // Button listeners
    document.getElementById('clear-workspace').addEventListener('click', clearWorkspace);
    document.getElementById('example-selector').addEventListener('change', handleExampleSelection);
    document.getElementById('copy-json').addEventListener('click', copyJSON);
    document.getElementById('download-json').addEventListener('click', downloadJSON);
    document.getElementById('add-test-btn').addEventListener('click', handleAddTest);
    document.getElementById('run-current-test-btn').addEventListener('click', runCurrentTest);
    document.getElementById('run-all-tests-btn').addEventListener('click', runAllTests);
    document.getElementById('show-json-btn').addEventListener('click', showJSONModal);
    document.getElementById('close-json-modal').addEventListener('click', hideJSONModal);
    document.getElementById('download-report-btn').addEventListener('click', downloadTestReport);
    document.getElementById('close-download-report-modal').addEventListener('click', hideDownloadReportModal);
    document.getElementById('download-json-report').addEventListener('click', downloadTestReportJSON);
    document.getElementById('download-markdown-report').addEventListener('click', downloadTestReportMarkdown);

    // Close modals when clicking outside
    document.getElementById('json-modal').addEventListener('click', (e) => {
        if (e.target.id === 'json-modal') {
            hideJSONModal();
        }
    });

    document.getElementById('download-report-modal').addEventListener('click', (e) => {
        if (e.target.id === 'download-report-modal') {
            hideDownloadReportModal();
        }
    });
}

function handleExampleSelection(e) {
    const exampleType = e.target.value;
    if (exampleType) {
        loadExample(exampleType);
        e.target.value = ''; // Reset selector
    }
}

// Drag and Drop Handlers
function handleDragStart(e) {
    draggedData = {
        fieldName: e.target.dataset.fieldName,
        blockType: e.target.dataset.blockType,
        transactionType: e.target.dataset.transactionType // For transaction type blocks
    };
    e.dataTransfer.effectAllowed = 'copy';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (e.currentTarget === e.target) {
        e.currentTarget.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!draggedData) return;

    // Check if it's a transaction type block
    if (draggedData.blockType === 'transaction-type') {
        setTransactionType(draggedData.transactionType);
    } else {
        addFieldBlock(draggedData.fieldName, draggedData.blockType);
    }

    draggedData = null;
    updateJSONOutput();
    saveTestsToStorage();
}

// Workspace Management
function setTransactionType(typeName) {
    const transaction = getCurrentTransaction();
    if (!transaction) {
        console.error('No current transaction');
        return;
    }

    // Update transaction type in the transaction object
    transaction.type = typeName;

    // Legacy support
    transactionType = typeName;

    // Find the transaction body for the current transaction
    const transactionBody = document.getElementById(`transaction-body-${transaction.id}`);
    if (!transactionBody) {
        console.error('Transaction body not found');
        return;
    }

    // Remove existing transaction type block if any
    const existingTypeBlock = transactionBody.querySelector('.workspace-block[data-field="TransactionType"]');
    if (existingTypeBlock) {
        existingTypeBlock.remove();
    }

    // Remove placeholder if present
    const placeholder = transactionBody.querySelector('.workspace-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const blockWrapper = createWorkspaceBlock('TransactionType', 'transaction-type', typeName, true);
    transactionBody.insertBefore(blockWrapper, transactionBody.firstChild);

    // Update section visibility based on current transaction state
    updateTransactionTypeSectionVisibility();

    // Update test queue to reflect the new transaction type
    renderTestQueue();

    // Show fields section and populate with relevant fields
    showFieldsForTransactionType(typeName);
}

function showFieldsForTransactionType(typeName) {
    const fieldsSection = document.getElementById('fields-section');
    const container = document.getElementById('available-fields-container');

    // Show the fields section
    fieldsSection.style.display = 'block';

    // Clear existing fields
    container.innerHTML = '';

    // Get valid fields for this transaction type
    let validFields = [];

    if (definitions.TRANSACTION_FORMATS && definitions.TRANSACTION_FORMATS[typeName]) {
        const format = definitions.TRANSACTION_FORMATS[typeName];
        validFields = format.map(f => ({
            name: f.name,
            required: f.required === 0 // 0 = required, 1 = optional, 2 = default
        }));
        console.log(`Found ${validFields.length} fields for ${typeName}:`, validFields.map(f => f.name));
    } else {
        console.warn(`No TRANSACTION_FORMATS found for ${typeName}`);
    }

    // Always add common fields if not already present
    const commonFields = ['Account', 'Fee', 'Sequence', 'LastLedgerSequence', 'SigningPubKey'];
    commonFields.forEach(fieldName => {
        if (!validFields.find(f => f.name === fieldName)) {
            validFields.push({ name: fieldName, required: false });
        }
    });

    // Sort: required first, then alphabetically
    validFields.sort((a, b) => {
        if (a.required !== b.required) return a.required ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    console.log(`Total fields to display: ${validFields.length}`);

    // Create field blocks
    validFields.forEach(field => {
        const fieldInfo = getFieldInfo(field.name);
        if (!fieldInfo) {
            console.warn(`No field info found for ${field.name}`);
            return;
        }

        const blockType = getBlockTypeForField(fieldInfo);
        const label = field.required ? `${field.name} *` : field.name;
        const block = createPaletteBlock(label, blockType, field.name);

        // Make required fields bold
        if (field.required) {
            block.style.fontWeight = 'bold';
        }

        container.appendChild(block);
    });
}

function getBlockTypeForField(fieldInfo) {
    const type = fieldInfo.type;

    if (type === 'AccountID') return 'account-field';
    if (type === 'Amount') return 'amount-field';
    if (type.startsWith('UInt') || type === 'Number') return 'number-field';
    if (type.startsWith('Hash')) return 'hash-field';
    if (type === 'Blob') return 'blob-field';

    return 'common-field';
}

function addFieldBlock(fieldName, blockType) {
    const transaction = getCurrentTransaction();
    if (!transaction) {
        console.error('No current transaction');
        return;
    }

    // Check if field already exists in current transaction
    const existing = transaction.blocks.find(b => b.fieldName === fieldName);
    if (existing) {
        showValidationMessage(`Field "${fieldName}" already added`, 'warning');
        return;
    }

    // Find the transaction body for the current transaction
    const transactionBody = document.getElementById(`transaction-body-${transaction.id}`);
    if (!transactionBody) {
        console.error('Transaction body not found');
        return;
    }

    const placeholder = transactionBody.querySelector('.workspace-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const blockWrapper = createWorkspaceBlock(fieldName, blockType, '', false);
    transactionBody.appendChild(blockWrapper);

    // Add to current transaction's blocks array
    transaction.blocks.push({
        fieldName: fieldName,
        value: ''
    });

    // Legacy support
    workspaceBlocks.push({
        fieldName: fieldName,
        value: ''
    });
}

function createWorkspaceBlock(fieldName, blockType, value, isTransactionType) {
    const wrapper = document.createElement('div');
    wrapper.className = 'workspace-block';
    wrapper.dataset.field = fieldName;

    const block = document.createElement('div');
    block.className = `block ${blockType}`;

    const label = document.createElement('span');
    label.className = 'block-label';
    label.textContent = fieldName + ':';
    block.appendChild(label);

    if (isTransactionType) {
        // Transaction type is a dropdown
        const select = document.createElement('select');
        select.className = 'block-input';

        const types = Object.keys(definitions.TRANSACTION_TYPES)
            .filter(name => definitions.TRANSACTION_TYPES[name] >= 0)
            .sort();

        types.forEach(typeName => {
            const option = document.createElement('option');
            option.value = typeName;
            option.textContent = typeName;
            if (typeName === value) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            transactionType = e.target.value;
            updateJSONOutput();
        });

        block.appendChild(select);
    } else {
        // Check if this is an Account field
        const fieldInfo = getFieldInfo(fieldName);
        const isAccountField = fieldInfo && fieldInfo.type === 'AccountID';

        if (isAccountField && accounts.length > 0) {
            // Create a container for input and dropdown
            const inputContainer = document.createElement('div');
            inputContainer.className = 'input-with-dropdown';

            // Regular input
            const input = document.createElement('input');
            input.className = 'block-input';
            input.type = 'text';
            input.placeholder = `Enter ${fieldName}`;
            input.value = value;

            input.addEventListener('input', (e) => {
                updateFieldValue(fieldName, e.target.value);
            });

            // Account selector dropdown
            const accountSelect = document.createElement('select');
            accountSelect.className = 'account-selector';
            accountSelect.title = 'Select from saved accounts';

            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '👤 Select Account';
            accountSelect.appendChild(placeholderOption);

            // Add accounts
            accounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.address;
                option.textContent = account.address;
                option.title = account.seed ? 'Has signing key' : 'View only';
                accountSelect.appendChild(option);
            });

            accountSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    input.value = e.target.value;
                    updateFieldValue(fieldName, e.target.value);
                    updateJSONOutput();
                }
                // Reset dropdown to placeholder
                e.target.value = '';
            });

            inputContainer.appendChild(input);
            inputContainer.appendChild(accountSelect);
            block.appendChild(inputContainer);
        } else {
            // Regular field is an input
            const input = document.createElement('input');
            input.className = 'block-input';
            input.type = 'text';
            input.placeholder = `Enter ${fieldName}`;
            input.value = value;

            input.addEventListener('input', (e) => {
                updateFieldValue(fieldName, e.target.value);
            });

            block.appendChild(input);
        }

        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'block-remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            removeFieldBlock(fieldName);
        });
        block.appendChild(removeBtn);
    }

    wrapper.appendChild(block);
    return wrapper;
}

function updateFieldValue(fieldName, value) {
    const transaction = getCurrentTransaction();
    if (transaction) {
        const blockIndex = transaction.blocks.findIndex(b => b.fieldName === fieldName);
        if (blockIndex >= 0) {
            transaction.blocks[blockIndex].value = value;
        }
    }

    // Legacy support
    const blockIndex = workspaceBlocks.findIndex(b => b.fieldName === fieldName);
    if (blockIndex >= 0) {
        workspaceBlocks[blockIndex].value = value;
    }

    updateJSONOutput();
}

function removeFieldBlock(fieldName) {
    const blockElement = document.querySelector(`.workspace-block[data-field="${fieldName}"]`);
    if (blockElement) {
        blockElement.remove();
    }

    const transaction = getCurrentTransaction();
    if (transaction) {
        transaction.blocks = transaction.blocks.filter(b => b.fieldName !== fieldName);
    }

    // Legacy support
    workspaceBlocks = workspaceBlocks.filter(b => b.fieldName !== fieldName);

    updateJSONOutput();
    saveTestsToStorage();

    // Show placeholder if workspace is empty
    const workspace = document.getElementById('workspace');
    if (workspace.children.length === 0) {
        showWorkspacePlaceholder();
    }
}

function showWorkspacePlaceholder() {
    const workspace = document.getElementById('workspace');
    const placeholder = document.createElement('div');
    placeholder.className = 'workspace-placeholder';
    placeholder.innerHTML = `
        <p>👆 Drag blocks here to build your transaction</p>
        <p class="hint">Start with a Transaction Type block</p>
    `;
    workspace.appendChild(placeholder);
}

function clearWorkspace() {
    // Clear all transactions
    transactions = [];
    currentTransactionId = null;
    nextTransactionNumber = 1;

    // Legacy support
    workspaceBlocks = [];
    transactionType = null;

    // Create a new empty transaction
    addTransaction('Test 1');

    // Update section visibility
    updateTransactionTypeSectionVisibility();

    renderWorkspace();
    updateJSONOutput();
    clearValidationMessages();
}

// JSON Output Generation
function updateJSONOutput() {
    const transaction = buildTransactionObject();
    const jsonOutput = document.getElementById('json-output');
    jsonOutput.textContent = JSON.stringify(transaction, null, 2);

    validateTransaction(transaction);
}

function buildTransactionObject() {
    const currentTx = getCurrentTransaction();
    const transaction = {};

    // Use current transaction if available, otherwise fall back to legacy
    const txType = currentTx ? currentTx.type : transactionType;
    const blocks = currentTx ? currentTx.blocks : workspaceBlocks;

    // Add transaction type
    if (txType) {
        transaction.TransactionType = txType;
    }

    // Add fields with values
    blocks.forEach(block => {
        // Convert value to string if it's not already
        const valueStr = typeof block.value === 'string' ? block.value : String(block.value);

        if (block.value && valueStr.trim() !== '') {
            // Try to convert to appropriate type
            const fieldInfo = getFieldInfo(block.fieldName);
            transaction[block.fieldName] = convertFieldValue(valueStr, fieldInfo);
        }
    });

    return transaction;
}

function getFieldInfo(fieldName) {
    const field = definitions.FIELDS.find(([name]) => name === fieldName);
    return field ? field[1] : null;
}

function convertFieldValue(value, fieldInfo) {
    if (!fieldInfo) return value;

    const type = fieldInfo.type;

    // Convert numeric types
    if (type.startsWith('UInt') || type === 'Number') {
        const num = parseInt(value, 10);
        return isNaN(num) ? value : num;
    }

    // Keep strings as-is for now
    return value;
}

// Validation
function validateTransaction(transaction) {
    clearValidationMessages();

    if (!transaction.TransactionType) {
        showValidationMessage('⚠️ Transaction Type is required', 'error');
        return;
    }

    // Check for required common fields
    const warnings = [];

    if (!transaction.Account) {
        warnings.push('💡 Account field is recommended');
    }

    if (!transaction.Fee) {
        warnings.push('💡 Fee field is recommended');
    }

    if (warnings.length > 0) {
        warnings.forEach(warning => showValidationMessage(warning, 'warning'));
    } else {
        showValidationMessage('✅ Transaction structure looks good!', 'success');
    }
}

function showValidationMessage(message, type) {
    const container = document.getElementById('validation-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `validation-message ${type}`;
    messageDiv.textContent = message;
    container.appendChild(messageDiv);
}

function clearValidationMessages() {
    const container = document.getElementById('validation-messages');
    container.innerHTML = '';
}

// Utility Functions
function copyJSON() {
    const jsonOutput = document.getElementById('json-output');
    const text = jsonOutput.textContent;
    const btn = document.getElementById('copy-json');

    navigator.clipboard.writeText(text).then(() => {
        showValidationMessage('✅ JSON copied to clipboard!', 'success');
        btn.classList.add('success-flash');
        setTimeout(() => {
            clearValidationMessages();
            btn.classList.remove('success-flash');
        }, 2000);
    }).catch(err => {
        showValidationMessage('❌ Failed to copy JSON', 'error');
    });
}

function downloadJSON() {
    const jsonOutput = document.getElementById('json-output');
    const text = jsonOutput.textContent;
    const btn = document.getElementById('download-json');

    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xrpl-transaction-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showValidationMessage('✅ JSON downloaded!', 'success');
    btn.classList.add('success-flash');
    setTimeout(() => {
        clearValidationMessages();
        btn.classList.remove('success-flash');
    }, 2000);
}

function loadExample(exampleType = 'payment') {
    clearWorkspace();

    const examples = {
        payment: {
            type: 'Payment',
            fields: [
                { name: 'Account', value: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnHf', class: 'account-field' },
                { name: 'Destination', value: 'rLHzPsX6oXkzU9rFkRrJYTetvcqrKKKKKK', class: 'account-field' },
                { name: 'Amount', value: '1000000', class: 'amount-field' },
                { name: 'Fee', value: '12', class: 'common-field' },
                { name: 'Sequence', value: '1', class: 'number-field' }
            ]
        },
        trustset: {
            type: 'TrustSet',
            fields: [
                { name: 'Account', value: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnHf', class: 'account-field' },
                { name: 'Fee', value: '12', class: 'common-field' },
                { name: 'Sequence', value: '1', class: 'number-field' },
                { name: 'LimitAmount', value: '1000000000', class: 'amount-field' }
            ]
        },
        accountset: {
            type: 'AccountSet',
            fields: [
                { name: 'Account', value: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnHf', class: 'account-field' },
                { name: 'Fee', value: '12', class: 'common-field' },
                { name: 'Sequence', value: '1', class: 'number-field' },
                { name: 'SetFlag', value: '5', class: 'number-field' }
            ]
        },
        offercreate: {
            type: 'OfferCreate',
            fields: [
                { name: 'Account', value: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnHf', class: 'account-field' },
                { name: 'Fee', value: '12', class: 'common-field' },
                { name: 'Sequence', value: '1', class: 'number-field' },
                { name: 'TakerGets', value: '1000000', class: 'amount-field' },
                { name: 'TakerPays', value: '2000000', class: 'amount-field' }
            ]
        }
    };

    const example = examples[exampleType];
    if (!example) return;

    setTransactionType(example.type);

    // Add fields with a slight delay for animation
    setTimeout(() => {
        example.fields.forEach((field, index) => {
            setTimeout(() => {
                addFieldBlock(field.name, field.class);
                setTimeout(() => {
                    setExampleValue(field.name, field.value);
                }, 50);
            }, index * 100);
        });

        setTimeout(() => {
            updateJSONOutput();
        }, example.fields.length * 100 + 100);
    }, 100);
}

function setExampleValue(fieldName, value) {
    const blockElement = document.querySelector(`.workspace-block[data-field="${fieldName}"]`);
    if (blockElement) {
        const input = blockElement.querySelector('.block-input');
        if (input) {
            input.value = value;
            updateFieldValue(fieldName, value);
        }
    }
}

// Keyboard Shortcuts
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to clear workspace
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            clearWorkspace();
        }

        // Ctrl/Cmd + C when focused on output to copy
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && e.target.id === 'json-output') {
            e.preventDefault();
            copyJSON();
        }

        // Ctrl/Cmd + S to download
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            downloadJSON();
        }

        // Escape to clear validation messages
        if (e.key === 'Escape') {
            clearValidationMessages();
        }
    });
}

// Network and Account Management
function initializeNetworkManagement() {
    // Network selector
    document.getElementById('network-select').addEventListener('change', (e) => {
        currentNetwork = e.target.value;
        updateNetworkInfo();
        saveNetworkToStorage();
        showMessage(`Switched to ${currentNetwork}`, 'info');
    });

    // Add account button
    document.getElementById('add-account-btn').addEventListener('click', addAccount);

    // Generate account button
    document.getElementById('generate-account-btn').addEventListener('click', generateAccount);

    // Transaction type search
    const searchInput = document.getElementById('tx-type-search');
    searchInput.addEventListener('input', (e) => {
        filterTransactionTypes(e.target.value);
    });

    // Initialize network info
    updateNetworkInfo();
}

function updateNetworkInfo() {
    const networkInfo = document.getElementById('network-info');
    const networks = {
        mainnet: 'wss://xrplcluster.com',
        testnet: 'wss://s.altnet.rippletest.net:51233',
        devnet: 'wss://s.devnet.rippletest.net:51233'
    };
    networkInfo.textContent = `Connected to ${currentNetwork.charAt(0).toUpperCase() + currentNetwork.slice(1)} (${networks[currentNetwork]})`;
}

function addAccount() {
    const address = prompt('Enter XRPL account address:');
    if (!address || address.trim() === '') return; // Cancelled or empty

    const accountAddress = address.trim();

    if (!isValidXRPLAddress(accountAddress)) {
        showMessage('❌ Invalid XRPL address format', 'error');
        return;
    }

    // Check if account already exists
    if (accounts.find(acc => acc.address === accountAddress)) {
        showMessage('⚠️ Account already added', 'warning');
        return;
    }

    accounts.push({
        address: accountAddress,
        seed: null // No seed for manually added accounts
    });
    renderAccounts();
    saveAccountsToStorage();
    showMessage(`✅ Account added: ${accountAddress}`, 'success');
}

async function generateAccount() {
    try {
        // Use xrpl.js to generate a new wallet
        if (typeof xrpl === 'undefined') {
            showMessage('❌ xrpl.js library not loaded', 'error');
            return;
        }

        const wallet = xrpl.Wallet.generate();

        accounts.push({
            address: wallet.address,
            seed: wallet.seed
        });

        renderAccounts();
        saveAccountsToStorage();
        showMessage(`✅ Generated new account: ${wallet.address}`, 'success');

        // Show seed in a prompt for user to save
        alert(`🔑 SAVE THIS SEED SAFELY!\n\nAddress: ${wallet.address}\nSeed: ${wallet.seed}\n\nYou will need this seed to sign transactions.`);

    } catch (error) {
        showMessage(`❌ Error generating account: ${error.message}`, 'error');
    }
}

function generateTestAddress() {
    // Generate a random test address (starts with 'r')
    const chars = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
    let address = 'r';
    for (let i = 0; i < 33; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
}

function isValidXRPLAddress(address) {
    // Basic validation: starts with 'r' and is 25-35 characters
    return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

async function fundAccount(address) {
    const faucets = {
        testnet: 'https://faucet.altnet.rippletest.net/accounts',
        devnet: 'https://faucet.devnet.rippletest.net/accounts'
    };

    const faucetUrl = faucets[currentNetwork];
    if (!faucetUrl) {
        showMessage('❌ Faucet not available for this network', 'error');
        return;
    }

    try {
        showMessage(`💰 Requesting funds for ${address}...`, 'info');

        const response = await fetch(faucetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                destination: address
            })
        });

        if (!response.ok) {
            throw new Error(`Faucet request failed: ${response.statusText}`);
        }

        const data = await response.json();
        showMessage(`✅ Account funded! Balance: ${data.balance?.value || 'Unknown'} XRP`, 'success');
        console.log('Faucet response:', data);

    } catch (error) {
        showMessage(`❌ Error funding account: ${error.message}`, 'error');
        console.error('Faucet error:', error);
    }
}

function renderAccounts() {
    const list = document.getElementById('accounts-list');
    list.innerHTML = '';

    if (accounts.length === 0) {
        list.innerHTML = '<p class="no-accounts">No accounts added</p>';
        refreshAccountDropdowns();
        return;
    }

    accounts.forEach((account, index) => {
        const item = document.createElement('div');
        item.className = 'account-item';

        const icon = document.createElement('span');
        icon.className = 'account-icon';
        icon.textContent = account.seed ? '🔑' : '👁️';
        icon.title = account.seed ? 'Has private key' : 'View only';

        const infoContainer = document.createElement('div');
        infoContainer.className = 'account-info';

        const addressSpan = document.createElement('div');
        addressSpan.className = 'account-address';
        addressSpan.textContent = account.address;
        addressSpan.title = account.address;

        const detailsSpan = document.createElement('div');
        detailsSpan.className = 'account-details';
        detailsSpan.innerHTML = '<span class="account-loading">Loading...</span>';

        infoContainer.appendChild(addressSpan);
        infoContainer.appendChild(detailsSpan);

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'account-buttons';

        // Add Refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'account-refresh';
        refreshBtn.textContent = '🔄';
        refreshBtn.title = 'Refresh account info';
        refreshBtn.addEventListener('click', () => fetchAccountInfo(account.address, detailsSpan));
        buttonContainer.appendChild(refreshBtn);

        // Add Fund button for testnet/devnet
        if (currentNetwork !== 'mainnet') {
            const fundBtn = document.createElement('button');
            fundBtn.className = 'account-fund';
            fundBtn.textContent = '💰';
            fundBtn.title = 'Fund account from faucet';
            fundBtn.addEventListener('click', () => fundAccount(account.address));
            buttonContainer.appendChild(fundBtn);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'account-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove account';
        removeBtn.addEventListener('click', () => {
            accounts.splice(index, 1);
            renderAccounts();
            saveAccountsToStorage();
            showMessage(`🗑️ Account removed: ${account.address}`, 'info');
        });

        buttonContainer.appendChild(removeBtn);

        item.appendChild(icon);
        item.appendChild(infoContainer);
        item.appendChild(buttonContainer);
        list.appendChild(item);

        // Fetch account info
        fetchAccountInfo(account.address, detailsSpan);
    });

    // Refresh all account dropdowns in workspace
    refreshAccountDropdowns();
}

async function fetchAccountInfo(address, detailsElement) {
    const networks = {
        mainnet: 'wss://xrplcluster.com',
        testnet: 'wss://s.altnet.rippletest.net:51233',
        devnet: 'wss://s.devnet.rippletest.net:51233'
    };

    const endpoint = networks[currentNetwork];

    try {
        console.log(`Fetching account info for ${address} on ${currentNetwork}...`);
        detailsElement.innerHTML = '<span class="account-loading">Loading...</span>';

        const client = new xrpl.Client(endpoint);
        await client.connect();
        console.log('Connected to network');

        const response = await client.request({
            command: 'account_info',
            account: address,
            ledger_index: 'validated'
        });

        console.log('Account info response:', response);

        await client.disconnect();

        const balance = (parseInt(response.result.account_data.Balance) / 1000000).toFixed(2);
        const sequence = response.result.account_data.Sequence;

        console.log(`Balance: ${balance} XRP, Sequence: ${sequence}`);

        detailsElement.innerHTML = `
            <span class="account-detail-item">💰 ${balance} XRP</span>
            <span class="account-detail-item">📊 Seq: ${sequence}</span>
        `;
    } catch (error) {
        console.error('Error fetching account info:', error);
        console.error('Error details:', error.data);

        if (error.data?.error === 'actNotFound') {
            detailsElement.innerHTML = '<span class="account-not-found">⚠️ Not funded</span>';
        } else {
            detailsElement.innerHTML = `<span class="account-error">❌ ${error.message || 'Error'}</span>`;
        }
    }
}

function refreshAccountDropdowns() {
    // First, update existing dropdowns
    const accountSelectors = document.querySelectorAll('.account-selector');

    accountSelectors.forEach(select => {
        const currentValue = select.value;

        // Clear existing options
        select.innerHTML = '';

        // Add placeholder
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = accounts.length > 0 ? '👤 Select Account' : '👤 No Accounts';
        placeholderOption.disabled = accounts.length === 0;
        select.appendChild(placeholderOption);

        // Add accounts
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.address;
            option.textContent = account.address;
            option.title = account.seed ? 'Has signing key' : 'View only';
            select.appendChild(option);
        });

        // Restore selection if it was set
        select.value = currentValue;
    });

    // Second, rebuild AccountID blocks that don't have dropdowns yet
    const workspaceBlocks = document.querySelectorAll('.workspace-block');
    workspaceBlocks.forEach(blockWrapper => {
        const fieldName = blockWrapper.dataset.field;
        if (!fieldName || fieldName === 'TransactionType') return;

        const fieldInfo = getFieldInfo(fieldName);
        const isAccountField = fieldInfo && fieldInfo.type === 'AccountID';

        // If it's an account field and doesn't have a dropdown yet, rebuild it
        if (isAccountField && !blockWrapper.querySelector('.account-selector') && accounts.length > 0) {
            const block = blockWrapper.querySelector('.block');
            const input = block.querySelector('.block-input');
            const currentValue = input ? input.value : '';

            // Get the block type
            const blockType = block.className.split(' ').find(c => c.endsWith('-field')) || 'common-field';

            // Remove the old input
            if (input) {
                input.remove();
            }

            // Create new input with dropdown
            const inputContainer = document.createElement('div');
            inputContainer.className = 'input-with-dropdown';

            const newInput = document.createElement('input');
            newInput.className = 'block-input';
            newInput.type = 'text';
            newInput.placeholder = `Enter ${fieldName}`;
            newInput.value = currentValue;

            newInput.addEventListener('input', (e) => {
                updateFieldValue(fieldName, e.target.value);
            });

            // Account selector dropdown
            const accountSelect = document.createElement('select');
            accountSelect.className = 'account-selector';
            accountSelect.title = 'Select from saved accounts';

            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '👤 Select Account';
            accountSelect.appendChild(placeholderOption);

            // Add accounts
            accounts.forEach(account => {
                const option = document.createElement('option');
                option.value = account.address;
                option.textContent = account.address;
                option.title = account.seed ? 'Has signing key' : 'View only';
                accountSelect.appendChild(option);
            });

            accountSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    newInput.value = e.target.value;
                    updateFieldValue(fieldName, e.target.value);
                    updateJSONOutput();
                }
                // Reset dropdown to placeholder
                e.target.value = '';
            });

            inputContainer.appendChild(newInput);
            inputContainer.appendChild(accountSelect);

            // Insert before the remove button
            const removeBtn = block.querySelector('.block-remove');
            block.insertBefore(inputContainer, removeBtn);
        }
    });
}

function filterTransactionTypes(searchTerm) {
    const blocks = document.querySelectorAll('#transaction-types-palette .block');
    const term = searchTerm.toLowerCase();

    blocks.forEach(block => {
        const text = block.textContent.toLowerCase();
        if (text.includes(term)) {
            block.style.display = '';
        } else {
            block.style.display = 'none';
        }
    });
}

async function submitTransaction() {
    const transaction = buildTransactionObject();

    if (!transactionType) {
        showMessage('❌ Please select a transaction type first', 'error');
        return;
    }

    // Check if we have an account with a seed
    const signingAccount = accounts.find(acc => acc.seed);
    if (!signingAccount) {
        showMessage('❌ No account with signing key available. Generate an account first.', 'error');
        return;
    }

    // Get network endpoint
    const networks = {
        mainnet: 'wss://xrplcluster.com',
        testnet: 'wss://s.altnet.rippletest.net:51233',
        devnet: 'wss://s.devnet.rippletest.net:51233'
    };

    const endpoint = networks[currentNetwork];

    try {
        showMessage(`🔄 Connecting to ${currentNetwork}...`, 'info');

        const client = new xrpl.Client(endpoint);
        await client.connect();

        showMessage('🔄 Preparing and signing transaction...', 'info');

        // Create wallet from seed
        const wallet = xrpl.Wallet.fromSeed(signingAccount.seed);

        // Auto-fill Account field if not set
        if (!transaction.Account) {
            transaction.Account = wallet.address;
        }

        // Submit and wait for validation (autofill and sign automatically)
        const result = await client.submitAndWait(transaction, {
            autofill: true,
            wallet: wallet
        });

        // Update workspace with the submitted transaction
        if (result.result.tx_json) {
            updateWorkspaceWithTransaction(result.result.tx_json);
            showMessage('✅ Transaction autofilled and signed', 'success');
        }

        await client.disconnect();

        if (result.result.meta.TransactionResult === 'tesSUCCESS') {
            const hash = result.result.hash;
            const explorerUrl = getExplorerUrl(hash, currentNetwork);
            showMessageWithLink(`✅ Transaction successful!`, hash, explorerUrl, 'success');
            console.log('Transaction result:', result);
        } else {
            showMessage(`⚠️ Transaction failed: ${result.result.meta.TransactionResult}`, 'warning');
            console.log('Transaction result:', result);
        }

    } catch (error) {
        showMessage(`❌ Error: ${error.message}`, 'error');
        console.error('Transaction error:', error);
    }
}

function getExplorerUrl(hash, network) {
    // Map network to subdomain
    const subdomain = network === 'mainnet' ? 'livenet' : network;
    return `https://${subdomain}.xrpl.org/transactions/${hash}`;
}

function updateWorkspaceWithTransaction(transaction) {
    // Update existing fields or add new ones with autofilled values
    Object.entries(transaction).forEach(([fieldName, value]) => {
        if (fieldName === 'TransactionType') return; // Skip, already set

        // Convert value to string
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

        // Check if field already exists in workspace
        const existingBlock = document.querySelector(`.workspace-block[data-field="${fieldName}"]`);

        if (existingBlock) {
            // Update existing field value
            const input = existingBlock.querySelector('.block-input');
            if (input) {
                input.value = valueStr;
                updateFieldValue(fieldName, valueStr);
            }
        } else {
            // Add new field block
            const fieldInfo = getFieldInfo(fieldName);
            if (fieldInfo) {
                const blockType = getBlockTypeForField(fieldInfo);

                // Add to workspace blocks array
                workspaceBlocks.push({
                    fieldName: fieldName,
                    value: valueStr
                });

                // Create and add the block to workspace
                const workspace = document.getElementById('workspace');
                const blockWrapper = createWorkspaceBlock(fieldName, blockType, valueStr, false);
                workspace.appendChild(blockWrapper);
            }
        }
    });

    updateJSONOutput();
}

// Local Storage Functions
const STORAGE_KEYS = {
    ACCOUNTS: 'xrpl_playground_accounts',
    TESTS: 'xrpl_playground_tests',
    CURRENT_NETWORK: 'xrpl_playground_network',
    NEXT_TEST_NUMBER: 'xrpl_playground_next_test_number'
};

function saveAccountsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
        console.log('Accounts saved to local storage:', accounts.length);
    } catch (e) {
        console.error('Failed to save accounts to local storage:', e);
    }
}

function loadAccountsFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
        if (stored) {
            accounts = JSON.parse(stored);
            console.log('Accounts loaded from local storage:', accounts.length);
            return true;
        }
    } catch (e) {
        console.error('Failed to load accounts from local storage:', e);
    }
    return false;
}

function saveTestsToStorage() {
    try {
        const testsData = {
            transactions: transactions,
            currentTransactionId: currentTransactionId,
            nextTransactionNumber: nextTransactionNumber
        };
        localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(testsData));
        console.log('Tests saved to local storage:', transactions.length);
    } catch (e) {
        console.error('Failed to save tests to local storage:', e);
    }
}

function loadTestsFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.TESTS);
        if (stored) {
            const testsData = JSON.parse(stored);
            transactions = testsData.transactions || [];
            currentTransactionId = testsData.currentTransactionId || null;
            nextTransactionNumber = testsData.nextTransactionNumber || 1;

            // If we have transactions but no current one, set the first as current
            if (transactions.length > 0 && !currentTransactionId) {
                currentTransactionId = transactions[0].id;
            }

            console.log('Tests loaded from local storage:', transactions.length);
            return true;
        }
    } catch (e) {
        console.error('Failed to load tests from local storage:', e);
    }
    return false;
}

function saveNetworkToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_NETWORK, currentNetwork);
    } catch (e) {
        console.error('Failed to save network to local storage:', e);
    }
}

function loadNetworkFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_NETWORK);
        if (stored) {
            currentNetwork = stored;
            console.log('Network loaded from local storage:', currentNetwork);
            return true;
        }
    } catch (e) {
        console.error('Failed to load network from local storage:', e);
    }
    return false;
}

function clearAllStorage() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('All local storage cleared');
        showToast('Local storage cleared', 'success');
    } catch (e) {
        console.error('Failed to clear local storage:', e);
    }
}

// Toast Notification System
function showToast(message, type = 'info', duration = 5000, link = null) {
    const container = document.getElementById('toast-container');

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon based on type
    const iconMap = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.textContent = iconMap[type] || iconMap.info;

    // Content
    const content = document.createElement('div');
    content.className = 'toast-content';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'toast-message';
    messageDiv.textContent = message;
    content.appendChild(messageDiv);

    // Add link if provided
    if (link) {
        const linkElement = document.createElement('a');
        linkElement.href = link.url;
        linkElement.target = '_blank';
        linkElement.rel = 'noopener noreferrer';
        linkElement.textContent = link.text;
        linkElement.className = 'toast-link';
        content.appendChild(linkElement);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => removeToast(toast);

    toast.appendChild(icon);
    toast.appendChild(content);
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }

    return toast;
}

function removeToast(toast) {
    toast.classList.add('removing');
    setTimeout(() => {
        toast.remove();
    }, 300); // Match animation duration
}

// Legacy function for backward compatibility
function showMessage(message, type = 'info') {
    showToast(message, type, 5000);
}

// Legacy function for backward compatibility
function showMessageWithLink(message, linkText, url, type = 'info') {
    showToast(message, type, 10000, { text: linkText, url: url });
}

