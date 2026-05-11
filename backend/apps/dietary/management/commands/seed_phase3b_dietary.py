"""Seed Indian hospital diet types + meal items."""
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital
from apps.dietary.models import DietType, MealItem, DietPlan, PatientMeal, KitchenOrder


DIET_TYPES = [
    # (code, name, cal, prot, carb, fat, sodium, diab, renal, cardiac, low_na, gluten_free)
    ("REG",     "Regular Diet",         2200, 70,  300, 60, 2000, False, False, False, False, False),
    ("DIAB",    "Diabetic Diet",        1800, 80,  200, 50, 1800, True,  False, False, False, False),
    ("CARDIAC", "Cardiac Diet",         1800, 70,  240, 40, 1500, False, False, True,  True,  False),
    ("RENAL",   "Renal Diet",           1800, 50,  280, 50, 1500, False, True,  False, True,  False),
    ("LIQUID",  "Full Liquid Diet",     1500, 50,  220, 40, 2000, False, False, False, False, False),
    ("CLEAR",   "Clear Liquid Diet",     500, 10,  100, 10, 1500, False, False, False, False, False),
    ("SOFT",    "Soft / Bland Diet",    1900, 65,  280, 50, 2000, False, False, False, False, False),
    ("PUREE",   "Pureed Diet",          1700, 60,  240, 50, 2000, False, False, False, False, False),
    ("HIPRO",   "High-Protein Diet",    2500, 110, 280, 70, 2000, False, False, False, False, False),
    ("LOWFAT",  "Low-Fat Diet",         1900, 70,  290, 30, 2000, False, False, True,  False, False),
    ("GLUTFREE","Gluten-Free Diet",     2100, 70,  290, 60, 2000, False, False, False, False, True),
    ("PED",     "Paediatric Diet",      1400, 45,  200, 45, 1500, False, False, False, False, False),
]


# (code, name, meal_type, desc, cal, prot, carb, fat, veg, jain, gluten, dairy, nuts, cost)
MEAL_ITEMS = [
    # Breakfast
    ("BF-IDLI",     "Idli with Sambar & Chutney",  "BREAKFAST", "2 idlis with sambar and coconut chutney", 280, 9, 50, 5,  True, True,  False, True,  False, 35),
    ("BF-POHA",     "Poha",                          "BREAKFAST", "Flattened rice with vegetables",         320, 7, 55, 8,  True, False, False, False, True,  30),
    ("BF-UPMA",     "Upma",                          "BREAKFAST", "Semolina with vegetables",               300, 8, 50, 7,  True, True,  True,  False, False, 30),
    ("BF-DALIA",    "Vegetable Dalia",               "BREAKFAST", "Broken wheat porridge with vegetables",  290, 9, 52, 6,  True, True,  True,  True,  False, 28),
    ("BF-OATS",     "Plain Oats with Milk",          "BREAKFAST", "Oats porridge with low-fat milk",        250, 10, 40, 5, True, True,  False, True,  False, 30),
    ("BF-EGGTOAST", "Egg & Toast",                   "BREAKFAST", "Boiled egg + 2 brown toast",            320, 18, 35, 12, False, False, True, True,  False, 40),

    # Mid-morning snack
    ("MS-FRUIT",    "Seasonal Fruit",                "MORNING_SNACK", "Apple/banana/papaya — 1 portion",   90,  1,  22, 0,  True, True,  False, False, False, 20),
    ("MS-COCO",     "Coconut Water",                 "MORNING_SNACK", "200 ml fresh coconut water",         45,  0,  10, 0,  True, True,  False, False, False, 35),
    ("MS-BUTTER",   "Buttermilk",                    "MORNING_SNACK", "200 ml plain buttermilk",            60,  3,  6,  3,  True, True,  False, True,  False, 15),

    # Lunch
    ("LN-DALRICE",  "Dal-Chawal Combo",              "LUNCH", "Yellow dal + rice + sabzi + curd",          550, 18, 90, 12, True, True,  False, True,  False, 80),
    ("LN-ROTISABZ", "Roti-Sabzi Thali",              "LUNCH", "3 rotis + dal + sabzi + curd + salad",      560, 20, 88, 14, True, True,  True,  True,  False, 75),
    ("LN-KHICHDI",  "Vegetable Khichdi",             "LUNCH", "Soft moong dal khichdi with ghee",          480, 16, 80, 10, True, True,  False, True,  False, 60),
    ("LN-SAMBAR",   "South Indian Lunch",            "LUNCH", "Rice + sambar + rasam + vegetables",        540, 16, 90, 12, True, True,  False, False, False, 75),
    ("LN-CHICKEN",  "Grilled Chicken Lunch",         "LUNCH", "Grilled chicken + brown rice + salad",      550, 35, 60, 15, False, False, False, False, False, 130),
    ("LN-FISH",     "Fish Curry Lunch",              "LUNCH", "Steamed fish curry + rice + salad",         500, 32, 65, 12, False, False, False, False, False, 140),

    # Evening snack
    ("ES-TEA",      "Tea + Marie Biscuit",           "EVENING_SNACK", "Light tea with 2 biscuits",         110, 2,  15, 4, True, True, True, True, False, 15),
    ("ES-SOUP",     "Vegetable Clear Soup",          "EVENING_SNACK", "Light vegetable broth",              60,  3,  8,  2,  True, True,  False, False, False, 25),
    ("ES-MILK",     "Warm Milk",                     "EVENING_SNACK", "200 ml low-fat milk",                90,  6,  10, 3,  True, True,  False, True,  False, 20),

    # Dinner
    ("DN-LIGHT",    "Light Dinner — Roti & Dal",     "DINNER", "2 rotis + dal + light sabzi",              420, 16, 65, 10, True, True,  True,  False, False, 55),
    ("DN-KHICHDI",  "Soft Khichdi Dinner",           "DINNER", "Light moong khichdi with vegetables",      400, 14, 70, 8,  True, True,  False, True,  False, 50),
    ("DN-CHICK",    "Chicken Dinner",                "DINNER", "Grilled chicken + roti + salad",           500, 32, 50, 14, False, False, True, False, False, 120),

    # Bedtime
    ("BT-MILK",     "Bedtime Warm Milk",             "BEDTIME", "200 ml warm milk with turmeric",          90,  6,  10, 3,  True, True,  False, True,  False, 20),
    ("BT-WATER",    "Plain Water (NPO-safe)",        "BEDTIME", "200 ml warm water",                       0,   0,  0,  0,  True, True,  False, False, False, 0),
]


class Command(BaseCommand):
    help = "Seed dietary types + meal items."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = Hospital.objects.first()
        if not hospital:
            self.stderr.write("No Hospital found.")
            return

        if options["reset"]:
            PatientMeal.objects.all().delete()
            DietPlan.objects.all().delete()
            KitchenOrder.objects.all().delete()
            MealItem.objects.all().delete()
            DietType.objects.all().delete()

        for (code, name, cal, prot, carb, fat, na, diab, renal, card, low_na, gf) in DIET_TYPES:
            obj, created = DietType.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "calories_per_day": cal,
                    "protein_g": prot, "carbs_g": carb, "fat_g": fat, "sodium_mg": na,
                    "is_diabetic_safe": diab, "is_renal_safe": renal,
                    "is_cardiac_safe": card, "is_low_sodium": low_na,
                    "is_gluten_free": gf, "is_active": True,
                },
            )
            self.stdout.write(f"  {'✓' if created else '↻'} Diet: {code} {name}")

        for (code, name, mt, desc, cal, prot, carb, fat,
              veg, jain, glu, dairy, nuts, cost) in MEAL_ITEMS:
            obj, created = MealItem.objects.update_or_create(
                hospital=hospital, code=code,
                defaults={
                    "name": name, "meal_type": mt, "description": desc,
                    "calories": cal,
                    "protein_g": Decimal(str(prot)),
                    "carbs_g": Decimal(str(carb)),
                    "fat_g": Decimal(str(fat)),
                    "is_vegetarian": veg, "is_jain": jain,
                    "contains_gluten": glu, "contains_dairy": dairy,
                    "contains_nuts": nuts,
                    "cost_per_serving": Decimal(str(cost)),
                    "is_active": True,
                },
            )
            self.stdout.write(f"  {'✓' if created else '↻'} Meal: {code} ({mt})")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {DietType.objects.count()} diet types, "
            f"{MealItem.objects.count()} meal items."
        ))
