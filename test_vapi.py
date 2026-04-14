import asyncio
from app.services.vapi_service import create_outbound_call

async def main():
    try:
        res = await create_outbound_call(
            assistant_id="799d1a7f-c222-4fdc-8dfa-cf3887236896", # User's dev assistant ID
            customer_number="+923074188483", # from user's earlier snippet
            system_prompt="Test"
        )
        print("SUCCESS:", res)
    except Exception as e:
        print("ERROR:", e)

asyncio.run(main())
