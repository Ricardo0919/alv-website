from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from migajas.models import Interaction


class Command(BaseCommand):
    help = "Asigna a un usuario las migajas creadas antes de que existieran cuentas (sin dueño)."

    def add_arguments(self, parser):
        parser.add_argument("username")

    def handle(self, *args, username, **options):
        try:
            user = get_user_model().objects.get(username__iexact=username)
        except get_user_model().DoesNotExist as exc:
            raise CommandError(f"No existe el usuario '{username}'. Créalo primero desde la app.") from exc

        updated = Interaction.objects.filter(user__isnull=True).update(user=user)
        self.stdout.write(self.style.SUCCESS(f"{updated} interacciones asignadas a {user.username}."))
