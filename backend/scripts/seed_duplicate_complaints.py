import asyncio
import os
import sys

from sqlalchemy.orm import Session

# Add the backend directory to sys.path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.category import Category
from app.models.ticket import Ticket
from app.models.user import User


def seed_duplicate_complaints(db: Session) -> None:
    print("Seeding duplicate complaints...")
    
    # Get residents
    residents = db.query(User).filter(User.role == "resident").limit(2).all()
    if len(residents) < 1:
        print("Not enough residents found. Please run seed_demo_users.py first.")
        return
        
    resident1 = residents[0]
    resident2 = residents[1] if len(residents) > 1 else residents[0]
    
    # Get a category (Plumbing or general)
    category = db.query(Category).first()
    if not category:
        print("No categories found. Please run seed_categories.py first.")
        return
        
    # Create master public ticket
    master_ticket = Ticket(
        title="Water leakage near swimming pool deck",
        resident_id=resident1.id,
        category_id=category.id,
        resident_note="There is a huge puddle near the pool.",
        is_public=True,
        priority="Medium"
    )
    db.add(master_ticket)
    db.commit()
    db.refresh(master_ticket)
    
    # Create duplicate child ticket
    child_ticket = Ticket(
        title="Poolside water leak",
        resident_id=resident2.id,
        category_id=category.id,
        resident_note="Slipped near the pool due to water leaking.",
        is_public=True,
        parent_ticket_id=master_ticket.id,
        priority="Medium"
    )
    db.add(child_ticket)
    db.commit()
    db.refresh(child_ticket)
    
    print(f"Created master ticket: {master_ticket.title} (ID: {master_ticket.id})")
    print(f"Created child ticket: {child_ticket.title} (ID: {child_ticket.id}) linked to master.")
    print("Successfully seeded duplicate complaints!")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_duplicate_complaints(db)
    finally:
        db.close()
