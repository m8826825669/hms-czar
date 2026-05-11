from rest_framework import serializers
from .models import AssetCategory, Asset, AssetMaintenanceLog, AMC, AssetDisposal


class AssetCategorySerializer(serializers.ModelSerializer):
    category_type_label = serializers.CharField(source="get_category_type_display",
                                                   read_only=True)
    class Meta:
        model = AssetCategory
        fields = "__all__"


class AssetMaintenanceLogSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_maintenance_type_display",
                                          read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    asset_code = serializers.CharField(source="asset.asset_code", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    class Meta:
        model = AssetMaintenanceLog
        fields = "__all__"


class AMCSerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source="asset.asset_code", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    days_to_expiry = serializers.IntegerField(read_only=True)
    class Meta:
        model = AMC
        fields = "__all__"


class AssetDisposalSerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source="asset.asset_code", read_only=True)
    type_label = serializers.CharField(source="get_disposal_type_display", read_only=True)
    class Meta:
        model = AssetDisposal
        fields = "__all__"


class AssetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_type = serializers.CharField(source="category.category_type", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    condition_label = serializers.CharField(source="get_condition_display", read_only=True)
    is_under_warranty = serializers.BooleanField(read_only=True)
    book_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    age_years = serializers.FloatField(read_only=True)
    maintenance_logs = AssetMaintenanceLogSerializer(many=True, read_only=True)
    amcs = AMCSerializer(many=True, read_only=True)

    class Meta:
        model = Asset
        fields = "__all__"
