"""Invoice domain service helpers - GST split rules etc."""

# Map state names to common variations to robustly compare
_STATE_ALIASES = {
    "delhi": "delhi", "new delhi": "delhi",
    "uttar pradesh": "uttar pradesh", "up": "uttar pradesh",
    "uttarakhand": "uttarakhand",
    "maharashtra": "maharashtra", "mh": "maharashtra",
    "karnataka": "karnataka", "ka": "karnataka",
    "tamil nadu": "tamil nadu", "tn": "tamil nadu",
    # Add more as needed
}


def normalize_state(name):
    if not name: return ""
    key = str(name).strip().lower()
    return _STATE_ALIASES.get(key, key)


def determine_gst_split(*, hospital_state, patient_state):
    """Given hospital and patient state, return:
        "INTRA"  - same state, CGST + SGST split
        "INTER"  - different state, IGST
        "EXEMPT" - if either is missing, default to INTRA (same-state assumption)
    """
    if not hospital_state and not patient_state:
        return "INTRA"  # Fallback when neither known
    h = normalize_state(hospital_state)
    p = normalize_state(patient_state)
    if not p:
        return "INTRA"  # No patient state -> assume local
    return "INTRA" if h == p else "INTER"
