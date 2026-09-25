import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models

class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Class',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('section', models.CharField(blank=True, max_length=50, null=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Class',
                'verbose_name_plural': 'Classes',
                'db_table': 'classes',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='MessageTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(db_index=True, max_length=100, unique=True)),
                ('category', models.CharField(default='UTILITY', max_length=50)),
                ('language', models.CharField(default='en_US', max_length=20)),
                ('description', models.CharField(blank=True, max_length=255, null=True)),
                ('body_preview', models.TextField(blank=True, null=True)),
                ('status', models.CharField(default='PENDING', max_length=30)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Message Template',
                'verbose_name_plural': 'Message Templates',
                'db_table': 'message_templates',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='MessageCampaign',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('total_recipients', models.IntegerField(default=0)),
                ('successful_count', models.IntegerField(default=0)),
                ('failed_count', models.IntegerField(default=0)),
                ('skipped_count', models.IntegerField(default=0)),
                ('status', models.CharField(default='PENDING', max_length=50)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('school_class', models.ForeignKey(blank=True, db_column='class_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='campaigns', to='api.class')),
                ('template', models.ForeignKey(blank=True, db_column='template_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='campaigns', to='api.messagetemplate')),
            ],
            options={
                'verbose_name': 'Message Campaign',
                'verbose_name_plural': 'Message Campaigns',
                'db_table': 'message_campaigns',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Student',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('student_name', models.CharField(max_length=150)),
                ('parent_name', models.CharField(blank=True, max_length=150, null=True)),
                ('whatsapp_number', models.CharField(db_index=True, max_length=20)),
                ('whatsapp_opt_in', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('school_class', models.ForeignKey(db_column='class_id', on_delete=django.db.models.deletion.CASCADE, related_name='students', to='api.class')),
            ],
            options={
                'verbose_name': 'Student',
                'verbose_name_plural': 'Students',
                'db_table': 'students',
                'ordering': ['student_name'],
            },
        ),
        migrations.CreateModel(
            name='MessageLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('recipient_number', models.CharField(max_length=20)),
                ('template_name', models.CharField(max_length=100)),
                ('status', models.CharField(default='QUEUED', max_length=50)),
                ('whatsapp_message_id', models.CharField(blank=True, db_index=True, max_length=255, null=True)),
                ('error_message', models.TextField(blank=True, null=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('failed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('campaign', models.ForeignKey(blank=True, db_column='campaign_id', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='message_logs', to='api.messagecampaign')),
                ('student', models.ForeignKey(blank=True, db_column='student_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='message_logs', to='api.student')),
            ],
            options={
                'verbose_name': 'Message Log',
                'verbose_name_plural': 'Message Logs',
                'db_table': 'message_logs',
                'ordering': ['-created_at'],
            },
        ),
    ]
