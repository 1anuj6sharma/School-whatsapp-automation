from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_chatmessage'),
    ]

    operations = [
        migrations.AddField(
            model_name='messagetemplate',
            name='variable_mappings',
            field=models.JSONField(blank=True, default=dict, help_text='Explicit default mappings for {{1}}, {{2}}, etc.', null=True),
        ),
    ]
