from django.urls import path
from . import views

urlpatterns = [
    path("", views.help_view, name="help"),
]
