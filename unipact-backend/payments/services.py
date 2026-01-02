import uuid

class MockStripeService:
    _intents = {} # In-memory storage for MVP (resets on restart)

    @classmethod
    def create_payment_intent(cls, amount, currency='myr'):
        intent_id = f"pi_mock_{uuid.uuid4().hex[:12]}"
        cls._intents[intent_id] = {
            'id': intent_id,
            'amount': amount,
            'currency': currency,
            'status': 'pending',
            'client_secret': f"{intent_id}_secret_{uuid.uuid4().hex[:6]}"
        }
        return cls._intents[intent_id]

    @classmethod
    def confirm_payment_intent(cls, intent_id):
        if intent_id in cls._intents:
            cls._intents[intent_id]['status'] = 'succeeded'
            return cls._intents[intent_id]
        return None

    @classmethod
    def retrieve_payment_intent(cls, intent_id):
        return cls._intents.get(intent_id)

    @classmethod
    def debug_set_status(cls, intent_id, status):
         if intent_id in cls._intents:
            cls._intents[intent_id]['status'] = status
