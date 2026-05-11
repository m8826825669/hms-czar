from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("stores", views.StoreLocationViewSet, basename="store")
router.register("categories", views.ItemCategoryViewSet, basename="category")
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("items", views.StockItemViewSet, basename="stock-item")
router.register("batches", views.StockBatchViewSet, basename="stock-batch")
router.register("purchase-orders", views.PurchaseOrderViewSet, basename="po")
router.register("grns", views.GRNViewSet, basename="grn")
router.register("requisitions", views.StockRequisitionViewSet, basename="requisition")
router.register("issues", views.StockIssueViewSet, basename="issue")
router.register("transfers", views.StockTransferViewSet, basename="transfer")

urlpatterns = [
    path("", include(router.urls)),
    path("stock-summary/", views.stock_summary, name="stock-summary"),
    path("expiring-soon/", views.expiring_soon, name="expiring-soon"),
]
