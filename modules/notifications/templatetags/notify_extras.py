from django import template

register = template.Library()

@register.filter
def notif_title(value, maxlen=80):
    if not value:
        return ""
    text = str(value).strip()
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    title = lines[0] if lines else text[:int(maxlen)]
    if len(title) > int(maxlen):
        return title[:int(maxlen)] + "…"
    return title

@register.filter
def notif_body(value, maxlen=0):
    if not value:
        return ""
    text = str(value).strip()
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if len(lines) > 1:
        body = " ".join(lines[1:])
        return body
    # if single line and maxlen given, return the remainder
    if int(maxlen) > 0 and len(text) > int(maxlen):
        return text[int(maxlen):].strip()
    # otherwise no body
    return ""