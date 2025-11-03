const stripe = Stripe('pk_live_xxx'); // or test key
const elements = stripe.elements();
const cardElement = elements.create('payment');
cardElement.mount('#card-element');
