const originalInput = document.getElementById('originalAmount');
const subtractedInput = document.getElementById('subtractedAmount');
const remainingOutput = document.getElementById('remainingAmount');
const recoveryOutput = document.getElementById('recoveryPercentage');
const validationMessage = document.getElementById('validationMessage');
const copyButton = document.getElementById('copyButton');
const resetButton = document.getElementById('resetButton');

const MAX_DECIMAL_PLACES = 6;
const DISPLAY_DECIMAL_PLACES = 2;
const INPUT_SCALE = 10n ** BigInt(MAX_DECIMAL_PLACES);
const DISPLAY_SCALE = 10n ** BigInt(DISPLAY_DECIMAL_PLACES);

let lastValidState = {
  original: '',
  subtracted: '',
  remaining: '0.00',
  recovery: '0.00%'
};

function stripFormatting(value) {
  return value.replace(/,/g, '').trim();
}

function formatIntegerWithCommas(value) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function normalizeDecimalInput(value) {
  const cleaned = stripFormatting(value).replace(/[^\d.]/g, '');

  if (cleaned === '') {
    return '';
  }

  const firstDotIndex = cleaned.indexOf('.');

  if (firstDotIndex === -1) {
    const wholeDigits = cleaned.replace(/^0+(?=\d)/, '') || '0';
    return formatIntegerWithCommas(wholeDigits);
  }

  const wholePart = cleaned.slice(0, firstDotIndex).replace(/^0+(?=\d)/, '') || '0';
  const decimalPart = cleaned
    .slice(firstDotIndex + 1)
    .replace(/\./g, '')
    .slice(0, MAX_DECIMAL_PLACES);

  const formattedWhole = formatIntegerWithCommas(wholePart);

  if (decimalPart.length === 0 && !cleaned.endsWith('.')) {
    return formattedWhole;
  }

  return `${formattedWhole}.${decimalPart}`;
}

function parseScaledDecimal(value) {
  const normalized = stripFormatting(value);

  if (normalized === '' || normalized === '.') {
    return null;
  }

  if (!/^\d*(\.\d*)?$/.test(normalized)) {
    return null;
  }

  const number = Number.parseFloat(normalized);
  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  const [wholePart = '0', fractionPart = ''] = normalized.split('.');
  const paddedFraction = `${fractionPart}000000`.slice(0, MAX_DECIMAL_PLACES);

  try {
    const scaledWhole = BigInt(wholePart || '0') * INPUT_SCALE;
    const scaledFraction = BigInt(paddedFraction || '0');
    return {
      number,
      scaled: scaledWhole + scaledFraction
    };
  } catch {
    return null;
  }
}

function formatScaledDecimal(scaledValue, { minimumDecimals = 0, maximumDecimals = 2 } = {}) {
  const decimalsToShow = Math.min(Math.max(minimumDecimals, 0), maximumDecimals);
  const roundingScale = 10n ** BigInt(MAX_DECIMAL_PLACES - maximumDecimals);
  const roundedValue = (scaledValue + roundingScale / 2n) / roundingScale;
  const displayScale = 10n ** BigInt(maximumDecimals);
  const wholePart = roundedValue / displayScale;
  const fractionPart = roundedValue % displayScale;
  const wholeText = formatIntegerWithCommas(wholePart.toString());

  if (maximumDecimals === 0) {
    return wholeText;
  }

  let fractionText = fractionPart.toString().padStart(maximumDecimals, '0');

  if (minimumDecimals === 0) {
    fractionText = fractionText.replace(/0+$/, '');
  } else if (fractionText.length > minimumDecimals) {
    fractionText = fractionText.replace(/0+$/, '');
    fractionText = fractionText.padEnd(minimumDecimals, '0');
  }

  if (fractionText === '') {
    return wholeText;
  }

  return `${wholeText}.${fractionText}`;
}

function formatInputValue(value) {
  return normalizeDecimalInput(value);
}

function setMessage(text, type = '') {
  validationMessage.textContent = text;
  validationMessage.className = `validation-message ${type}`.trim();
}

function updateResults({ original, subtracted }) {
  const remaining = original.scaled - subtracted.scaled;
  const recovery = remaining > 0n ? (subtracted.scaled * 100n * INPUT_SCALE) / remaining : null;

  remainingOutput.textContent = formatScaledDecimal(remaining, { minimumDecimals: 2, maximumDecimals: 2 });
  recoveryOutput.textContent = recovery === null ? 'N/A' : `${formatScaledDecimal(recovery, { minimumDecimals: 2, maximumDecimals: 2 })}%`;

  lastValidState = {
    original: originalInput.value,
    subtracted: subtractedInput.value,
    remaining: remainingOutput.textContent,
    recovery: recoveryOutput.textContent
  };
}

function validateAndCalculate() {
  const original = parseScaledDecimal(originalInput.value);
  const subtracted = parseScaledDecimal(subtractedInput.value);

  if (original === null && subtracted === null) {
    remainingOutput.textContent = '0.00';
    recoveryOutput.textContent = '0.00%';
    setMessage('Enter values to begin.');
    return;
  }

  if (original === null || subtracted === null) {
    setMessage('Enter both amounts to calculate the result.');
    return;
  }

  if (subtracted.scaled > original.scaled) {
    remainingOutput.textContent = '0.00';
    recoveryOutput.textContent = '0.00%';
    setMessage('Subtracted amount cannot be greater than the original amount.', 'error');
    return;
  }

  updateResults({ original, subtracted });

  if (original.scaled === 0n) {
    setMessage('Original amount must be greater than zero.', 'error');
    return;
  }

  if (original.scaled === subtracted.scaled) {
    setMessage('Recovery percentage is undefined when the remaining amount is zero.', 'error');
    return;
  }

  setMessage('Calculation updated live.', 'success');
}

function handleTyping(event) {
  const formatted = formatInputValue(event.target.value);
  event.target.value = formatted;
  validateAndCalculate();
}

function copyResult() {
  const resultText = `Remaining Amount: ${remainingOutput.textContent}\nRecovery Percentage: ${recoveryOutput.textContent}`;

  navigator.clipboard.writeText(resultText).then(() => {
    setMessage('Result copied to clipboard.', 'success');
    copyButton.classList.add('pulse');
    window.setTimeout(() => copyButton.classList.remove('pulse'), 260);
  }).catch(() => {
    setMessage('Copy failed. Please copy the result manually.', 'error');
  });
}

function resetCalculator() {
  originalInput.value = '';
  subtractedInput.value = '';
  remainingOutput.textContent = '0.00';
  recoveryOutput.textContent = '0.00%';
  setMessage('Enter values to begin.');
  originalInput.focus();
}

originalInput.addEventListener('input', handleTyping);
subtractedInput.addEventListener('input', handleTyping);
copyButton.addEventListener('click', copyResult);
resetButton.addEventListener('click', resetCalculator);

[originalInput, subtractedInput].forEach((input) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (document.activeElement === originalInput) {
        subtractedInput.focus();
      } else {
        copyResult();
      }
    }
  });

  input.addEventListener('blur', validateAndCalculate);
});

validateAndCalculate();
