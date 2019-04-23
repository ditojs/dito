const creditCardRegExp = /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|(222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})|62[0-9]{14}$/

export function isCreditCard(str) {
  str = str && str.replace(/[\s-]+/g, '')
  if (!str || str.length > 16 || !creditCardRegExp.test(str)) {
    return false
  }
  // The Luhn-Algorithm:
  let check = 0
  let even = false
  for (let i = str.length - 1; i >= 0; i--) {
    let digit = +str[i]
    if (even && (digit *= 2) > 9) {
      digit -= 9
    }
    check += digit
    even = !even
  }
  return (check % 10) === 0
}
